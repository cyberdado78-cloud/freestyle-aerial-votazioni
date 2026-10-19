-- Additive, service-only account ownership and trial enforcement. Existing tenants are preserved.
create table if not exists public.scoreflow_organization_accounts (
 tenant_key varchar(80) primary key references public.scoreflow_tenants(tenant_key) on delete cascade,
 owner_id uuid not null unique references auth.users(id),
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default (now() + interval '14 days'),
 email_attempts integer not null default 0 check (email_attempts between 0 and 10),
 check (trial_ends_at = trial_started_at + interval '14 days')
);
alter table public.scoreflow_organization_accounts enable row level security;
revoke all on public.scoreflow_organization_accounts from public,anon,authenticated;
grant select,insert,update,delete on public.scoreflow_organization_accounts to service_role;
create table if not exists public.scoreflow_trial_email_claims (
 tenant_key varchar(80) not null references public.scoreflow_organization_accounts(tenant_key) on delete cascade,
 notification_id text not null,
 created_at timestamptz not null default now(),
 primary key (tenant_key,notification_id)
);
alter table public.scoreflow_trial_email_claims enable row level security;
revoke all on public.scoreflow_trial_email_claims from public,anon,authenticated;
grant select,insert,update,delete on public.scoreflow_trial_email_claims to service_role;

create or replace function public.scoreflow_is_licensed(p_tenant text) returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.scoreflow_license_codes where tenant_key=p_tenant and active and (expires_at is null or expires_at > now()));
$$;

-- Called while the subscription row is locked by every writer, including registrations.
create or replace function public.scoreflow_check_trial_state(p_tenant text,p_state jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare registered integer; manual integer; ev jsonb; e jsonb; sub public.scoreflow_organization_accounts; old_event text;
begin
 select * into sub from public.scoreflow_organization_accounts where tenant_key=p_tenant for update;
 if not found or public.scoreflow_is_licensed(p_tenant) then return; end if;
 if sub.trial_ends_at <= now() then raise exception 'scoreflow:trial-expired' using errcode='P0001'; end if;
 if jsonb_typeof(p_state->'events') is distinct from 'array' or jsonb_array_length(p_state->'events') <> 1 then raise exception 'scoreflow:limit-events'; end if;
 ev := p_state->'events'->0;
 select state_json->'events'->0->>'id' into old_event from public.scoreflow_tenants where tenant_key=p_tenant;
 if old_event is not null and ev->>'id' is distinct from old_event then raise exception 'scoreflow:event-immutable'; end if;
 if jsonb_array_length(coalesce(ev->'categories','[]')) > 2 then raise exception 'scoreflow:limit-categories'; end if;
 if jsonb_array_length(coalesce(ev->'judges','[]')) > 3 or coalesce((ev->'scoring'->>'judgeCount')::int,0) > 3 then raise exception 'scoreflow:limit-judges'; end if;
 if coalesce((ev->'publicVoting'->>'enabled')::boolean,false) or jsonb_array_length(coalesce(ev->'publicVotes','[]')) > 0 then raise exception 'scoreflow:feature-public-voting'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(ev->'participants','[]')) p where p->>'registrationId' is not null group by p->>'registrationId',p->>'registrationAthleteId' having count(*)>1) then raise exception 'scoreflow:duplicate-athlete'; end if;
 if jsonb_array_length(coalesce(ev->'participants','[]')) > 6 then raise exception 'scoreflow:limit-athletes'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(ev->'participants','[]')) p group by p->>'id' having count(*)>1) then raise exception 'scoreflow:duplicate-athlete'; end if;
 -- An approved registration appearing in the roster uses its original slot once.
 with profiles as (
  select a.id::text account_id, x.profile from public.scoreflow_athlete_accounts a
  cross join lateral jsonb_array_elements(case when a.profile_json->>'accountType'='group' then coalesce(a.profile_json->'athletes','[]') else jsonb_build_array(a.profile_json) end) x(profile)
  where a.tenant_key=p_tenant
 ) select count(*) into manual from jsonb_array_elements(coalesce(ev->'participants','[]')) p
 where not exists(select 1 from profiles r where p->>'registrationId'=r.account_id
 and p->>'registrationAthleteId'=coalesce(r.profile->>'id','legacy-'||r.account_id)
 and lower(trim(p->>'name'))=lower(trim(concat(r.profile->>'firstName',' ',r.profile->>'lastName'))));
 select coalesce(sum(case when profile_json->>'accountType'='group' then jsonb_array_length(coalesce(profile_json->'athletes','[]')) else 1 end),0)
 into registered from public.scoreflow_athlete_accounts where tenant_key=p_tenant;
 if registered+manual > 6 then raise exception 'scoreflow:limit-athletes'; end if;
end;
$$;

create or replace function public.scoreflow_trial_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare sub public.scoreflow_organization_accounts; current_state jsonb;
begin
 select * into sub from public.scoreflow_organization_accounts where tenant_key=new.tenant_key for update;
 if not found then return new; end if;
 if public.scoreflow_is_licensed(new.tenant_key) then return new; end if;
 if sub.trial_ends_at <= now() then raise exception 'scoreflow:trial-expired'; end if;
 if tg_table_name='scoreflow_tenants' then
  perform public.scoreflow_check_trial_state(new.tenant_key,new.state_json);
  new.state_json := jsonb_set(new.state_json,'{subscription}',jsonb_build_object('plan','trial','status','trialing','trialDays',14,'trialStartedAt',sub.trial_started_at,'trialEndsAt',sub.trial_ends_at));
 end if;
 return new;
end;
$$;
create or replace function public.scoreflow_registration_trial_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare current_state jsonb;
begin
 select state_json into current_state from public.scoreflow_tenants where tenant_key=new.tenant_key;
 perform public.scoreflow_check_trial_state(new.tenant_key,current_state);
 return new;
end;
$$;
drop trigger if exists scoreflow_trial_guard on public.scoreflow_tenants;
create trigger scoreflow_trial_guard before update on public.scoreflow_tenants for each row execute function public.scoreflow_trial_guard();
drop trigger if exists scoreflow_trial_guard on public.scoreflow_athlete_accounts;
create trigger scoreflow_trial_guard before insert or update on public.scoreflow_athlete_accounts for each row execute function public.scoreflow_trial_guard();
drop trigger if exists scoreflow_registration_trial_guard on public.scoreflow_athlete_accounts;
create trigger scoreflow_registration_trial_guard after insert or update on public.scoreflow_athlete_accounts for each row execute function public.scoreflow_registration_trial_guard();
drop trigger if exists scoreflow_trial_guard on public.scoreflow_email_settings;
create trigger scoreflow_trial_guard before insert or update on public.scoreflow_email_settings for each row execute function public.scoreflow_trial_guard();
drop trigger if exists scoreflow_trial_guard on public.scoreflow_access_tokens;
create trigger scoreflow_trial_guard before insert or update on public.scoreflow_access_tokens for each row execute function public.scoreflow_trial_guard();

create or replace function public.scoreflow_create_trial(p_owner uuid,p_tenant text,p_name text,p_hash text,p_state jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare sub public.scoreflow_organization_accounts;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,0));
 if exists(select 1 from public.scoreflow_organization_accounts where owner_id=p_owner) then raise exception 'scoreflow:organization-exists'; end if;
 insert into public.scoreflow_tenants(tenant_key,display_name,secret_hash,state_json,revision) values(p_tenant,p_name,p_hash,p_state,1);
 insert into public.scoreflow_organization_accounts(tenant_key,owner_id) values(p_tenant,p_owner) returning * into sub;
 update public.scoreflow_tenants set state_json=p_state where tenant_key=p_tenant;
 return jsonb_build_object('tenantKey',p_tenant,'revision',1,'created',true);
end;
$$;
create or replace function public.scoreflow_claim_trial_email(p_tenant text,p_notification text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare sub public.scoreflow_organization_accounts;
begin
 select * into sub from public.scoreflow_organization_accounts where tenant_key=p_tenant for update;
 if not found or public.scoreflow_is_licensed(p_tenant) then return true; end if;
 if sub.trial_ends_at <= now() or sub.email_attempts >= 10 then return false; end if;
 insert into public.scoreflow_trial_email_claims(tenant_key,notification_id) values(p_tenant,p_notification) on conflict do nothing;
 if not found then return true; end if;
 update public.scoreflow_organization_accounts set email_attempts=email_attempts+1 where tenant_key=p_tenant;
 return true;
end;
$$;
revoke all on function public.scoreflow_is_licensed(text), public.scoreflow_check_trial_state(text,jsonb), public.scoreflow_trial_guard(), public.scoreflow_registration_trial_guard(), public.scoreflow_create_trial(uuid,text,text,text,jsonb), public.scoreflow_claim_trial_email(text,text) from public,anon,authenticated;
grant execute on function public.scoreflow_is_licensed(text), public.scoreflow_check_trial_state(text,jsonb), public.scoreflow_trial_guard(), public.scoreflow_registration_trial_guard(), public.scoreflow_create_trial(uuid,text,text,text,jsonb), public.scoreflow_claim_trial_email(text,text) to service_role;

-- All app traffic goes through the Node server. Browser-supplied header secrets cannot create extra free tenants through PostgREST.
revoke all on public.scoreflow_tenants,public.scoreflow_access_tokens,public.scoreflow_athlete_accounts,public.scoreflow_athlete_sessions,public.scoreflow_email_settings,public.scoreflow_license_codes from anon,authenticated;

-- Legacy helper RPC permissions were left unchanged; extra hardening needs a compatibility review.
