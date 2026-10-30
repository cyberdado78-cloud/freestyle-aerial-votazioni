-- ScoreFlow 3.2.0: public voting and on-demand QR are available in the trial.
-- All existing trial limits remain enforced.
create or replace function public.scoreflow_check_trial_state(p_tenant text,p_state jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare registered integer; manual integer; ev jsonb; sub public.scoreflow_organization_accounts; old_event text;
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

