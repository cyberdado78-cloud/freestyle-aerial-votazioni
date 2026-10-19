begin;
alter table public.scoreflow_email_settings add column delivery_mode text not null default 'managed'
  check (delivery_mode in ('managed','custom'));
-- Preserve external accounts already configured by clients.
update public.scoreflow_email_settings set delivery_mode='custom' where api_key_encrypted is not null;
-- The previous constraint only supported external-provider credentials.
alter table public.scoreflow_email_settings drop constraint scoreflow_email_settings_check;
alter table public.scoreflow_email_settings add constraint scoreflow_email_settings_enabled_check
  check (not enabled or (delivery_mode='managed' and sender_name <> '' and reply_to <> '')
    or (delivery_mode='custom' and api_key_encrypted is not null and sender_email <> ''));
commit;
