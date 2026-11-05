begin;
create table public.scoreflow_email_settings (
  tenant_key text primary key references public.scoreflow_tenants(tenant_key) on delete cascade,
  enabled boolean not null default false,
  sender_name text not null default '' check (length(sender_name) <= 100),
  sender_email text not null default '' check (length(sender_email) <= 254),
  reply_to text not null default '' check (length(reply_to) <= 254),
  api_key_encrypted text,
  last_test_at timestamptz,
  last_test_status text not null default '' check (last_test_status in ('','testing','accepted','failed')),
  updated_at timestamptz not null default now(),
  check (not enabled or (api_key_encrypted is not null and sender_email <> ''))
);
alter table public.scoreflow_email_settings enable row level security;
revoke all on public.scoreflow_email_settings from anon, authenticated;
grant select, insert, update on public.scoreflow_email_settings to anon, authenticated;
grant all on public.scoreflow_email_settings to service_role;
create policy scoreflow_email_owner_select on public.scoreflow_email_settings for select to anon, authenticated
  using (public.scoreflow_request_is_tenant(tenant_key));
create policy scoreflow_email_owner_insert on public.scoreflow_email_settings for insert to anon, authenticated
  with check (public.scoreflow_request_is_tenant(tenant_key));
create policy scoreflow_email_owner_update on public.scoreflow_email_settings for update to anon, authenticated
  using (public.scoreflow_request_is_tenant(tenant_key)) with check (public.scoreflow_request_is_tenant(tenant_key));
commit;
