-- AIM CG v49: FastField PDF parsing support and Tradify/OneDrive job-pack imports.
-- Safe to run more than once. Run after v48.

create extension if not exists pgcrypto;

alter table public.fastfield_submissions
  add column if not exists parse_attempted_at timestamptz,
  add column if not exists parsed_at timestamptz,
  add column if not exists parse_source text,
  add column if not exists parse_confidence numeric,
  add column if not exists source_file_size bigint;

insert into storage.buckets (id, name, public)
values ('job-pack-imports', 'job-pack-imports', false)
on conflict (id) do update set public = excluded.public;

create table if not exists public.job_pack_imports (
  id uuid primary key default gen_random_uuid(),
  external_import_id text not null unique,
  source text not null default 'power_automate',
  original_file_name text not null,
  source_file_size bigint,
  file_hash text,
  storage_bucket text not null default 'job-pack-imports',
  storage_object_path text not null,
  processing_status text not null default 'received',
  import_status text not null default 'pending',
  parsed_fields jsonb not null default '{}'::jsonb,
  job_id uuid references public.jobs(id) on delete set null,
  error_message text,
  received_at timestamptz not null default now(),
  parsed_at timestamptz,
  imported_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists job_pack_imports_status_idx on public.job_pack_imports(import_status, received_at desc);
create index if not exists job_pack_imports_job_idx on public.job_pack_imports(job_id);
create index if not exists job_pack_imports_hash_idx on public.job_pack_imports(file_hash);

alter table public.job_pack_imports enable row level security;
grant select, insert, update, delete on public.job_pack_imports to authenticated;
grant all on public.job_pack_imports to service_role;

drop policy if exists "Admins manage job pack imports" on public.job_pack_imports;
create policy "Admins manage job pack imports" on public.job_pack_imports
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)));

drop policy if exists "Admins read job pack imports" on storage.objects;
create policy "Admins read job pack imports" on storage.objects for select to authenticated
using (
  bucket_id='job-pack-imports'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true))
);

create or replace function public.aimcg_create_job_from_pack(p_import_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v public.job_pack_imports%rowtype;
  f jsonb;
  v_job_id uuid;
  v_existing uuid;
  v_attachment uuid;
  v_job_no text;
  v_wo text;
begin
  if not exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)) then
    raise exception 'Admin permission required';
  end if;
  select * into v from job_pack_imports where id=p_import_id for update;
  if not found then raise exception 'Job pack import not found'; end if;
  f := coalesce(v.parsed_fields,'{}'::jsonb);
  v_job_no := nullif(trim(f->>'jobNumber'),'');
  v_wo := nullif(trim(f->>'workOrderNumber'),'');
  if nullif(trim(f->>'title'),'') is null then raise exception 'A job title/reference was not extracted'; end if;
  if v_job_no is null and v_wo is null then raise exception 'A job number or work order is required before import'; end if;

  select j.id into v_existing from jobs j
  where (v_job_no is not null and regexp_replace(upper(coalesce(j.job_number,'')),'[^0-9]','','g') = regexp_replace(upper(v_job_no),'[^0-9]','','g'))
     or (v_wo is not null and regexp_replace(upper(coalesce(j.work_order_number,'')),'\s','','g') = regexp_replace(upper(v_wo),'\s','','g'))
  order by j.updated_at desc limit 1;

  if v_existing is not null then
    update job_pack_imports set job_id=v_existing, import_status='duplicate_existing_job', processing_status='review_required', updated_at=now()
    where id=p_import_id;
    return v_existing;
  end if;

  v_job_id := gen_random_uuid();
  insert into jobs(
    id,title,client,site,address,job_number,quote_number,work_order_number,po_number,description,
    category,materials_status,client_contact,client_phone,appointment_sent,client_accepted,
    completed_confirmed,item_type,app_payload,updated_at
  ) values (
    v_job_id,
    coalesce(nullif(trim(f->>'title'),''),'Imported Tradify job'),
    nullif(trim(f->>'client'),''), nullif(trim(f->>'site'),''), nullif(trim(f->>'address'),''),
    v_job_no, nullif(trim(f->>'quoteNumber'),''), v_wo, nullif(trim(f->>'poNumber'),''), nullif(trim(f->>'notes'),''),
    'To be scheduled','Parts from stock',null,null,false,false,false,'normal_job',
    jsonb_build_object(
      'id',v_job_id,'title',coalesce(nullif(trim(f->>'title'),''),'Imported Tradify job'),
      'client',coalesce(f->>'client',''),'site',coalesce(f->>'site',''),'address',coalesce(f->>'address',''),
      'jobNumber',coalesce(v_job_no,''),'quoteNumber',coalesce(f->>'quoteNumber',''),
      'workOrderNumber',coalesce(v_wo,''),'poNumber',coalesce(f->>'poNumber',''),
      'notes',coalesce(f->>'notes',''),'category','To be scheduled','materialsStatus','Parts from stock',
      'assignedTo',jsonb_build_array(),'startDate','','endDate','','scheduleBlocks',jsonb_build_array(),
      'workerStatus','{}'::jsonb,'workerCompletions','{}'::jsonb,'noteHistory',jsonb_build_array(),
      'materials',jsonb_build_array(),'attachments',jsonb_build_array(),'itemType','normal_job',
      'importSource','tradify_job_pack','jobPackImportId',p_import_id,'updatedFromAppAt',now()
    ),now()
  );

  insert into attachments(job_id,bucket,object_path,file_name,mime_type,size_bytes,attachment_type,label,uploaded_by)
  values(v_job_id,v.storage_bucket,v.storage_object_path,v.original_file_name,'application/pdf',coalesce(v.source_file_size,0),'job_pack','Tradify Job Pack',auth.uid())
  on conflict(bucket,object_path) do update set job_id=excluded.job_id
  returning id into v_attachment;

  insert into job_history(job_id,action,details,created_by)
  values(v_job_id,'Job imported from Tradify pack',concat('Created in To be scheduled from ',v.original_file_name,'.'),auth.uid());

  update job_pack_imports set job_id=v_job_id, import_status='imported', processing_status='complete', imported_at=now(), updated_at=now(), error_message=null
  where id=p_import_id;
  return v_job_id;
end $$;

grant execute on function public.aimcg_create_job_from_pack(uuid) to authenticated;

do $$ begin alter publication supabase_realtime add table public.job_pack_imports;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
