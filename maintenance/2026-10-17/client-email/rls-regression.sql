begin;
insert into public.scoreflow_tenants(tenant_key,display_name,secret_hash) values ('qa-email-rls-20261017','QA RLS rollback',encode(extensions.digest('qa-only-randomish-secret-rls-20261017-long','sha256'),'hex'));
set local role anon;
select set_config('request.headers','{"x-scoreflow-key":"qa-only-randomish-secret-rls-20261017-long"}',true);
insert into public.scoreflow_email_settings(tenant_key,sender_email) values('qa-email-rls-20261017','qa@example.invalid');
do $$ begin
if (select count(*) from public.scoreflow_email_settings where tenant_key='qa-email-rls-20261017') <> 1 then raise exception 'Owner read failed'; end if;
end $$;
select set_config('request.headers','{"x-scoreflow-key":"qa-another-organization-secret"}',true);
do $$ declare count_changed integer; begin
if exists(select 1 from public.scoreflow_email_settings where tenant_key='qa-email-rls-20261017') then raise exception 'Cross tenant read leaked'; end if;
update public.scoreflow_email_settings set sender_email='blocked@example.invalid' where tenant_key='qa-email-rls-20261017';
get diagnostics count_changed = row_count;
if count_changed <> 0 then raise exception 'Cross tenant update allowed'; end if;
begin
insert into public.scoreflow_email_settings(tenant_key,sender_email) values('qa-email-rls-forbidden','blocked@example.invalid');
raise exception 'Cross tenant insert allowed';
exception when insufficient_privilege then null;
end;
end $$;
select set_config('request.headers','{"x-scoreflow-access":"qa-device-not-owner"}',true);
do $$ begin
if exists(select 1 from public.scoreflow_email_settings where tenant_key='qa-email-rls-20261017') then raise exception 'Staff read leaked'; end if;
end $$;
reset role;
select json_build_object('owner_read_write',true,'cross_tenant_read_blocked',true,'cross_tenant_update_blocked',true,'cross_tenant_insert_blocked',true,'staff_read_blocked',true) as result;
rollback;