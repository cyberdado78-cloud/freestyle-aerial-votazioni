-- Run after the migration in one transaction and ROLLBACK; synthetic fixtures only.
do $$
declare
 u1 uuid:='e053cc98-7074-4c7c-96a7-ef4c8bbb1fd1';
 u2 uuid:='e053cc98-7074-4c7c-96a7-ef4c8bbb1fd2';
 first_end timestamptz; next_end timestamptz; result jsonb; denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(u1,'qa-license-one@example.invalid',now()),(u2,'qa-license-two@example.invalid',now());
 insert into public.scoreflow_license_codes(code_hash,plan,duration_months) values
 (repeat('1',64),'professional',3),(repeat('2',64),'professional',6),(repeat('3',64),'professional',12);
 result:=public.scoreflow_redeem_license(repeat('1',64),u1,null);
 first_end:=(result->>'expiresAt')::timestamptz;
 if first_end is distinct from ((now() at time zone 'UTC' + interval '3 months') at time zone 'UTC') then raise exception 'duration incorrect'; end if;
 if exists(select 1 from public.scoreflow_organization_accounts where owner_id=u1) then raise exception 'activation created an unwanted organization'; end if;
 result:=public.scoreflow_redeem_license(repeat('1',64),u1,null);
 if (result->>'expiresAt')::timestamptz is distinct from first_end or not (result->>'alreadyActivated')::boolean then raise exception 'retry extended license'; end if;
 denied:=false;
 begin perform public.scoreflow_redeem_license(repeat('1',64),u2,null); exception when others then denied:=sqlerrm like '%invalid-license%'; end;
 if not denied then raise exception 'second owner redeemed code'; end if;
 result:=public.scoreflow_redeem_license(repeat('2',64),u1,null);
 next_end:=(result->>'expiresAt')::timestamptz;
 if next_end is distinct from ((first_end at time zone 'UTC' + interval '6 months') at time zone 'UTC') then raise exception 'renewal lost residual time'; end if;
 result:=public.scoreflow_create_trial(u1,'qa-commercial-license-rollback','QA synthetic',repeat('9',64),'{"events":[{"id":"qa-license","categories":[{},{},{}],"scoring":{"judgeCount":4},"judges":[],"participants":[],"scores":[]}]}');
 if (select count(*) from public.scoreflow_license_codes where owner_id=u1 and tenant_key='qa-commercial-license-rollback')<>2 then raise exception 'licenses not bound to new tenant'; end if;
 if not public.scoreflow_is_licensed('qa-commercial-license-rollback') then raise exception 'paid tenant not licensed'; end if;
 result:=public.scoreflow_redeem_license(repeat('3',64),u2,null);
 if (result->>'expiresAt')::timestamptz is distinct from ((now() at time zone 'UTC' + interval '12 months') at time zone 'UTC') then raise exception '12 month duration incorrect'; end if;
 if has_function_privilege('anon','public.scoreflow_redeem_license(text,uuid,text)','execute') or has_function_privilege('authenticated','public.scoreflow_redeem_license(text,uuid,text)','execute') then raise exception 'redemption rpc publicly callable'; end if;
 if not has_function_privilege('service_role','public.scoreflow_redeem_license(text,uuid,text)','execute') then raise exception 'server cannot redeem'; end if;
 if (timestamp '2028-02-29' + interval '12 months')<>timestamp '2029-02-28' or (timestamp '2027-01-31' + interval '3 months')<>timestamp '2027-04-30' then raise exception 'month end arithmetic'; end if;
 update public.scoreflow_license_codes set expires_at=now()-interval '1 second' where owner_id=u1;
 denied:=false;
 begin update public.scoreflow_tenants set state_json=state_json where tenant_key='qa-commercial-license-rollback'; exception when others then denied:=sqlerrm like '%license-expired%'; end;
 if not denied then raise exception 'paid expiry fell back into trial'; end if;
 update public.scoreflow_organization_accounts set trial_started_at=now()-interval '15 days',trial_ends_at=now()-interval '1 day' where owner_id=u1;
 denied:=false;
 begin update public.scoreflow_tenants set state_json=state_json where tenant_key='qa-commercial-license-rollback'; exception when others then denied:=sqlerrm like '%license-expired%'; end;
 if not denied then raise exception 'expired license permitted mutation'; end if;
 result:=public.scoreflow_issue_shop_license('store_QA:order:line:1',3,repeat('4',64),'v1.ENCRYPTED-FIXTURE','buyer@example.invalid','store_QA','order','line',1);
 if (result->>'duration_months')::integer<>3 then raise exception 'wrong delivery duration'; end if;
 result:=public.scoreflow_issue_shop_license('store_QA:order:line:1',3,repeat('5',64),'v1.SECOND-FIXTURE','buyer@example.invalid','store_QA','order','line',1);
 if (select count(*) from public.scoreflow_license_codes where order_key='store_QA:order:line:1')<>1 then raise exception 'order issued twice'; end if;
 if public.scoreflow_claim_license_delivery('store_QA:order:line:1') is null then raise exception 'first delivery claim failed'; end if;
 if public.scoreflow_claim_license_delivery('store_QA:order:line:1') is not null then raise exception 'concurrent delivery claim accepted'; end if;
 update public.scoreflow_license_deliveries set claim_until=now()-interval '1 second' where order_key='store_QA:order:line:1';
 if public.scoreflow_claim_license_delivery('store_QA:order:line:1') is null then raise exception 'delivery retry unavailable'; end if;
 update public.scoreflow_license_deliveries set sent_at=now() where order_key='store_QA:order:line:1';
 if public.scoreflow_claim_license_delivery('store_QA:order:line:1') is not null then raise exception 'sent delivery claimed again'; end if;
 if has_function_privilege('anon','public.scoreflow_issue_shop_license(text,integer,text,text,text,text,text,text,integer)','execute') or has_function_privilege('authenticated','public.scoreflow_claim_license_delivery(text)','execute') then raise exception 'public issue/delivery RPC'; end if;
end;
$$;
