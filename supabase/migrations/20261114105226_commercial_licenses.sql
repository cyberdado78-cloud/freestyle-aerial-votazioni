-- Paid licenses start on redemption; all redemption writes are atomic.
alter table public.scoreflow_license_codes
 add column if not exists owner_id uuid references auth.users(id),
 add column if not exists duration_months integer check (duration_months in (3,6,12)),
 add column if not exists order_key text unique;
create index if not exists scoreflow_license_owner_idx on public.scoreflow_license_codes(owner_id) where owner_id is not null;
create or replace function public.scoreflow_redeem_license(p_hash text,p_owner uuid default null,p_tenant text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare lic public.scoreflow_license_codes; bound_owner uuid; target_tenant text; base_time timestamptz; end_time timestamptz;
begin
 if p_owner is null and p_tenant is null then raise exception 'scoreflow:invalid-license'; end if;
 if p_owner is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,0)); end if;
 target_tenant:=p_tenant;
 if target_tenant is not null then
  select owner_id into bound_owner from public.scoreflow_organization_accounts where tenant_key=target_tenant;
  if found and bound_owner is distinct from p_owner then raise exception 'scoreflow:invalid-license'; end if;
 elsif p_owner is not null then
  select tenant_key into target_tenant from public.scoreflow_organization_accounts where owner_id=p_owner;
 end if;
 select * into lic from public.scoreflow_license_codes where code_hash=p_hash for update;
 if not found or not lic.active or (lic.tenant_key is not null and lic.tenant_key is distinct from target_tenant) or (lic.owner_id is not null and lic.owner_id is distinct from p_owner) then raise exception 'scoreflow:invalid-license'; end if;
 if lic.activation_count>0 then
  if ((p_owner is not null and lic.owner_id=p_owner) or (p_owner is null and target_tenant is not null and lic.tenant_key=target_tenant)) and (lic.expires_at is null or lic.expires_at>now()) then
   return jsonb_build_object('plan',lic.plan,'status','active','expiresAt',lic.expires_at,'durationMonths',lic.duration_months,'alreadyActivated',true);
  end if;
  raise exception 'scoreflow:invalid-license';
 end if;
 if lic.max_activations<>1 or (lic.expires_at is not null and lic.expires_at<=now()) then raise exception 'scoreflow:invalid-license'; end if;
 if exists(select 1 from public.scoreflow_license_codes l where l.id<>lic.id and l.active and l.activated_at is not null and l.expires_at is null and ((p_owner is not null and l.owner_id=p_owner) or (target_tenant is not null and l.tenant_key=target_tenant))) then raise exception 'scoreflow:permanent-license'; end if;
 if lic.duration_months is not null then
  select greatest(now(),coalesce(max(l.expires_at),now())) into base_time from public.scoreflow_license_codes l
  where l.id<>lic.id and l.active and l.activated_at is not null and ((p_owner is not null and l.owner_id=p_owner) or (target_tenant is not null and l.tenant_key=target_tenant));
  end_time:=(base_time at time zone 'UTC' + pg_catalog.make_interval(months=>lic.duration_months)) at time zone 'UTC';
 else end_time:=lic.expires_at;
 end if;
 update public.scoreflow_license_codes set owner_id=p_owner,tenant_key=target_tenant,activation_count=1,activated_at=now(),expires_at=end_time where id=lic.id;
 return jsonb_build_object('plan',lic.plan,'status','active','expiresAt',end_time,'durationMonths',lic.duration_months,'alreadyActivated',false);
end;
$$;
revoke all on function public.scoreflow_redeem_license(text,uuid,text) from public,anon,authenticated;
grant execute on function public.scoreflow_redeem_license(text,uuid,text) to service_role;
create or replace function public.scoreflow_create_trial(p_owner uuid,p_tenant text,p_name text,p_hash text,p_state jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare sub public.scoreflow_organization_accounts;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,0));
 if exists(select 1 from public.scoreflow_organization_accounts where owner_id=p_owner) then raise exception 'scoreflow:organization-exists'; end if;
 insert into public.scoreflow_tenants(tenant_key,display_name,secret_hash,state_json,revision) values(p_tenant,p_name,p_hash,p_state,1);
 insert into public.scoreflow_organization_accounts(tenant_key,owner_id) values(p_tenant,p_owner) returning * into sub;
 update public.scoreflow_license_codes set tenant_key=p_tenant where owner_id=p_owner and tenant_key is null and active and activated_at is not null;
 update public.scoreflow_tenants set state_json=p_state where tenant_key=p_tenant;
 return jsonb_build_object('tenantKey',p_tenant,'revision',1,'created',true);
end;
$$;

create table if not exists public.scoreflow_license_deliveries (
 order_key text primary key,
 license_id uuid not null unique references public.scoreflow_license_codes(id),
 store_id text not null,
 order_id text not null,
 line_id text not null,
 unit integer not null check(unit between 1 and 100),
 duration_months integer not null check(duration_months in (3,6,12)),
 buyer_email text not null,
 code_cipher text not null,
 created_at timestamptz not null default now(),
 first_attempt_at timestamptz,
 claim_until timestamptz,
 attempts integer not null default 0,
 sent_at timestamptz,
 last_error text
);
alter table public.scoreflow_license_deliveries enable row level security;
revoke all on public.scoreflow_license_deliveries from anon,authenticated;
grant select,insert,update on public.scoreflow_license_deliveries to service_role;
create or replace function public.scoreflow_issue_shop_license(p_order_key text,p_months integer,p_hash text,p_cipher text,p_email text,p_store text,p_order text,p_line text,p_unit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare delivery public.scoreflow_license_deliveries; lic_id uuid;
begin
 if p_months not in (3,6,12) or p_unit not between 1 and 100 or p_hash !~ '^[a-f0-9]{64}$' or p_cipher not like 'v1.%' or length(p_email)>254 or p_order_key<>concat(p_store,':',p_order,':',p_line,':',p_unit) then raise exception 'scoreflow:invalid-license-order'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_key,0));
 select * into delivery from public.scoreflow_license_deliveries where order_key=p_order_key;
 if found then
  if delivery.duration_months<>p_months or delivery.buyer_email<>p_email then raise exception 'scoreflow:license-order-mismatch'; end if;
  return to_jsonb(delivery);
 end if;
 insert into public.scoreflow_license_codes(code_hash,plan,duration_months,order_key) values(p_hash,'professional',p_months,p_order_key) returning id into lic_id;
 insert into public.scoreflow_license_deliveries(order_key,license_id,store_id,order_id,line_id,unit,duration_months,buyer_email,code_cipher) values(p_order_key,lic_id,p_store,p_order,p_line,p_unit,p_months,p_email,p_cipher) returning * into delivery;
 return to_jsonb(delivery);
end;
$$;
create or replace function public.scoreflow_claim_license_delivery(p_order_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare delivery public.scoreflow_license_deliveries;
begin
 update public.scoreflow_license_deliveries set last_error='manual-review-required' where order_key=p_order_key and sent_at is null and first_attempt_at<now()-interval '23 hours';
 update public.scoreflow_license_deliveries set claim_until=now()+interval '5 minutes',first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
 where order_key=p_order_key and sent_at is null and (claim_until is null or claim_until<now()) and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours') returning * into delivery;
 if not found then return null; end if;
 return to_jsonb(delivery);
end;
$$;
revoke all on function public.scoreflow_issue_shop_license(text,integer,text,text,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.scoreflow_claim_license_delivery(text) from public,anon,authenticated;
grant execute on function public.scoreflow_issue_shop_license(text,integer,text,text,text,text,text,text,integer) to service_role;
grant execute on function public.scoreflow_claim_license_delivery(text) to service_role;

-- A paid account never falls back into a residual trial after expiry or revocation.
create or replace function public.scoreflow_paid_access_expired(p_tenant text)
returns boolean language sql stable security invoker set search_path='' as $$
 select not public.scoreflow_is_licensed(p_tenant) and exists(select 1 from public.scoreflow_license_codes where tenant_key=p_tenant and activated_at is not null and (duration_months is not null or expires_at is not null));
$$;
revoke all on function public.scoreflow_paid_access_expired(text) from public,anon,authenticated;
grant execute on function public.scoreflow_paid_access_expired(text) to service_role;
create or replace function public.scoreflow_trial_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare sub public.scoreflow_organization_accounts;
begin
 select * into sub from public.scoreflow_organization_accounts where tenant_key=new.tenant_key for update;
 if not found then return new; end if;
 if public.scoreflow_is_licensed(new.tenant_key) then return new; end if;
 if public.scoreflow_paid_access_expired(new.tenant_key) then raise exception 'scoreflow:license-expired'; end if;
 if sub.trial_ends_at<=now() then raise exception 'scoreflow:trial-expired'; end if;
 if tg_table_name='scoreflow_tenants' then
  perform public.scoreflow_check_trial_state(new.tenant_key,new.state_json);
  new.state_json:=jsonb_set(new.state_json,'{subscription}',jsonb_build_object('plan','trial','status','trialing','trialDays',14,'trialStartedAt',sub.trial_started_at,'trialEndsAt',sub.trial_ends_at));
 end if;
 return new;
end;
$$;

-- Apply the same paid-expiry guard to registration/roster validation.
create or replace function public.scoreflow_check_trial_state(p_tenant text,p_state jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare registered integer; manual integer; ev jsonb; sub public.scoreflow_organization_accounts; old_event text;
begin
 select * into sub from public.scoreflow_organization_accounts where tenant_key=p_tenant for update;
 if not found or public.scoreflow_is_licensed(p_tenant) then return; end if;
 if public.scoreflow_paid_access_expired(p_tenant) then raise exception 'scoreflow:license-expired'; end if;
 if sub.trial_ends_at <= now() then raise exception 'scoreflow:trial-expired' using errcode='P0001'; end if;
 if jsonb_typeof(p_state->'events') is distinct from 'array' or jsonb_array_length(p_state->'events') <> 1 then raise exception 'scoreflow:limit-events'; end if;
 ev := p_state->'events'->0;
 select state_json->'events'->0->>'id' into old_event from public.scoreflow_tenants where tenant_key=p_tenant;
 if old_event is not null and ev->>'id' is distinct from old_event then raise exception 'scoreflow:event-immutable'; end if;
 if jsonb_array_length(coalesce(ev->'categories','[]')) > 2 then raise exception 'scoreflow:limit-categories'; end if;
 if jsonb_array_length(coalesce(ev->'judges','[]')) > 3 or coalesce((ev->'scoring'->>'judgeCount')::int,0) > 3 then raise exception 'scoreflow:limit-judges'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(ev->'participants','[]')) p where p->>'registrationId' is not null group by p->>'registrationId',p->>'registrationAthleteId' having count(*)>1) then raise exception 'scoreflow:duplicate-athlete'; end if;
 if jsonb_array_length(coalesce(ev->'participants','[]')) > 6 then raise exception 'scoreflow:limit-athletes'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(ev->'participants','[]')) p group by p->>'id' having count(*)>1) then raise exception 'scoreflow:duplicate-athlete'; end if;
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

