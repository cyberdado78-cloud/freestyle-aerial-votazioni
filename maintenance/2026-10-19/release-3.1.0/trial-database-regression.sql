-- Run after trial-schema.sql inside BEGIN ... ROLLBACK. No test record is retained.
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000003110','scoreflow-transaction-qa@example.invalid',now());
set local role service_role;
do $$
declare s jsonb; p jsonb; a uuid; ok boolean; i int; got jsonb;
begin
 s := '{"id":"qa-org","name":"Transactional QA","events":[{"id":"qa-event","categories":[{"id":"c1"},{"id":"c2"}],"judges":[{},{},{}],"scoring":{"judgeCount":3},"participants":[],"publicVoting":{"enabled":false},"publicVotes":[]}],"subscription":{"status":"active","trialDays":90}}';
 perform public.scoreflow_create_trial('00000000-0000-4000-8000-000000003110','qa-trial-transaction-3110','Transactional QA',repeat('a',64),s);
 select state_json into s from public.scoreflow_tenants where tenant_key='qa-trial-transaction-3110';
 if s->'subscription'->>'status'<>'trialing' or (s->'subscription'->>'trialDays')::int<>14 then raise exception 'FAILED server-owned dates'; end if;
 begin perform public.scoreflow_create_trial('00000000-0000-4000-8000-000000003110','qa-trial-extra-3110','Extra',repeat('b',64),s); raise exception 'FAILED extra organization allowed'; exception when others then if sqlerrm not like '%scoreflow:organization-exists%' then raise; end if; end;
 begin update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,categories}','[{},{},{}]') where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED extra category allowed'; exception when others then if sqlerrm not like '%scoreflow:limit-categories%' then raise; end if; end;
 begin update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,scoring,judgeCount}','4') where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED extra judge allowed'; exception when others then if sqlerrm not like '%scoreflow:limit-judges%' then raise; end if; end;
 begin update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,publicVoting,enabled}','true') where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED public voting allowed'; exception when others then if sqlerrm not like '%scoreflow:feature-public-voting%' then raise; end if; end;
 begin update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,id}','"new-event"') where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED new event allowed'; exception when others then if sqlerrm not like '%scoreflow:event-immutable%' then raise; end if; end;
 p:='{"accountType":"group","athletes":[]}';
 for i in 1..6 loop p:=jsonb_set(p,'{athletes}',(p->'athletes')||jsonb_build_array(jsonb_build_object('id','athlete-'||i,'firstName','QA','lastName',i::text))); end loop;
 insert into public.scoreflow_athlete_accounts(tenant_key,event_id,email,password_hash,profile_json,status) values('qa-trial-transaction-3110','qa-event','group@example.invalid','not-a-real-password',p,'pre-registered') returning id into a;
 begin insert into public.scoreflow_athlete_accounts(tenant_key,event_id,email,password_hash,profile_json,status) values('qa-trial-transaction-3110','qa-event','seventh@example.invalid','not-a-real-password','{"id":"extra","firstName":"QA","lastName":"7"}','pre-registered'); raise exception 'FAILED seventh public athlete allowed'; exception when others then if sqlerrm not like '%scoreflow:limit-athletes%' then raise; end if; end;
 s:=jsonb_set(s,'{events,0,participants}',jsonb_build_array(jsonb_build_object('id','roster-1','registrationId',a::text,'registrationAthleteId','athlete-1','name','QA 1')));
 update public.scoreflow_tenants set state_json=s where tenant_key='qa-trial-transaction-3110';
 begin update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,participants}',(s->'events'->0->'participants')||'[{"id":"manual-7","name":"Extra Person"}]') where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED mixed athlete limit'; exception when others then if sqlerrm not like '%scoreflow:limit-athletes%' then raise; end if; end;
 begin update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,participants,0,name}','"Different Person"') where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED forged registration link'; exception when others then if sqlerrm not like '%scoreflow:limit-athletes%' then raise; end if; end;
 for i in 1..10 loop if not public.scoreflow_claim_trial_email('qa-trial-transaction-3110','mail-'||i) then raise exception 'FAILED quota under limit'; end if; end loop;
 if public.scoreflow_claim_trial_email('qa-trial-transaction-3110','mail-11') then raise exception 'FAILED eleventh email allowed'; end if;
 update public.scoreflow_organization_accounts set trial_started_at=now()-interval '15 days',trial_ends_at=now()-interval '1 day' where tenant_key='qa-trial-transaction-3110';
 begin update public.scoreflow_tenants set state_json=s where tenant_key='qa-trial-transaction-3110'; raise exception 'FAILED expired state write'; exception when others then if sqlerrm not like '%scoreflow:trial-expired%' then raise; end if; end;
 begin update public.scoreflow_athlete_accounts set status='registered' where id=a; raise exception 'FAILED expired profile write'; exception when others then if sqlerrm not like '%scoreflow:trial-expired%' then raise; end if; end;
 select state_json into got from public.scoreflow_tenants where tenant_key='qa-trial-transaction-3110';
 if got is null then raise exception 'FAILED expired data preservation'; end if;
 if public.scoreflow_claim_trial_email('qa-trial-transaction-3110','expired-mail') then raise exception 'FAILED expired email'; end if;
 -- A valid activated license lifts restrictions without changing the organization.
 insert into public.scoreflow_license_codes(code_hash,plan,tenant_key,active) values(repeat('c',64),'professional','qa-trial-transaction-3110',true);
 update public.scoreflow_tenants set state_json=jsonb_set(s,'{events,0,scoring,judgeCount}','4') where tenant_key='qa-trial-transaction-3110';
end;
$$;
reset role;
select 'PASS: account uniqueness, fixed trial, 2 categories, 3 judges, public vote restriction, fixed event, 6 grouped/public athletes, combined manual count, linked approval deduplication, forged link rejection, email quota, expired writes, preserved reads, license upgrade' as result;
