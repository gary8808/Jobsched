-- Jobsched v36 - ClickSend inbound SMS webhook support
create extension if not exists "pgcrypto";

-- The v35 messages table already stores inbound and outbound SMS.
-- These columns give us a place to keep inbound webhook matching/debug details.
alter table public.messages add column if not exists matched_by text;
alter table public.messages add column if not exists inbound_rule_id text;
alter table public.messages add column if not exists provider_user_id text;

create index if not exists messages_direction_actioned_idx on public.messages(direction, unread, actioned);
create index if not exists messages_from_number_idx on public.messages(from_number);
create index if not exists messages_provider_message_id_idx on public.messages(provider_message_id);

alter table public.messages enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.messages to service_role;
grant select, insert, update, delete on public.jobs to service_role;
grant select, insert, update, delete on public.job_history to service_role;

-- Keep pilot policies in place if they already exist.
drop policy if exists "Authenticated users can read messages during pilot" on public.messages;
create policy "Authenticated users can read messages during pilot"
on public.messages
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage messages during pilot" on public.messages;
create policy "Authenticated users can manage messages during pilot"
on public.messages
for all
to authenticated
using (true)
with check (true);
