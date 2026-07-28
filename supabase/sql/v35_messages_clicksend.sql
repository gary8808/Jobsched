-- Jobsched v35 - Messages backend and ClickSend SMS support
create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  channel text not null default 'sms',
  direction text not null default 'out',
  message_text text not null,
  to_number text,
  from_number text,
  provider text,
  provider_message_id text,
  status text not null default 'sent',
  unread boolean not null default false,
  actioned boolean not null default false,
  actioned_by uuid references auth.users(id) on delete set null,
  actioned_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  app_payload jsonb not null default '{}'::jsonb
);

create index if not exists messages_job_id_idx on public.messages(job_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create index if not exists messages_unread_idx on public.messages(unread, actioned);

alter table public.messages enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.messages to service_role;

-- Broad pilot policies. Replace with stricter admin/employee policies before full launch.
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

-- If your project has automatic table exposure disabled, these grants help Edge Functions and signed-in users use the API.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.jobs to service_role;
grant select, insert, update, delete on public.job_history to service_role;
