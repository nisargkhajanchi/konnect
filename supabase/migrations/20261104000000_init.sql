-- Home Konnect initial schema.
-- Access model:
--   * Families see only patients they are members of (patient_members).
--   * Providers see visits booked with their organisation, and the patient's records
--     only while the family has sharing on for an open visit.
--   * Visits are written only through the security-definer functions below, so a provider
--     can never read the door code or change who a visit belongs to.

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ tables */

create table public.provider_orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  join_code text not null unique,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  kind text not null default 'family' check (kind in ('family', 'provider')),
  provider_role text check (provider_role in ('nurse', 'physio', 'coordinator', 'supplier')),
  provider_org_id uuid references public.provider_orgs (id),
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  age int check (age between 0 and 120),
  sex text,
  condition text,
  hospital text,
  discharged_on date,
  treating_doctor text,
  address text,
  bp_limit_sys int not null default 140 check (bp_limit_sys between 90 and 200),
  bp_limit_dia int not null default 90 check (bp_limit_dia between 50 and 130),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.patient_members (
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('primary', 'backup', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (patient_id, user_id)
);
create index on public.patient_members (user_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  storage_path text not null unique,
  kind text not null default 'discharge_summary' check (kind in ('discharge_summary', 'report')),
  mime_type text,
  status text not null default 'uploaded' check (status in ('uploaded', 'reading', 'read', 'failed', 'confirmed')),
  extraction jsonb,
  error text,
  model text,
  uploaded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.documents (patient_id);

create table public.care_plans (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  follow_ups jsonb not null default '[]',
  limits jsonb not null default '[]',
  warning_signs jsonb not null default '[]',
  allergies jsonb not null default '[]',
  diet_activity jsonb not null default '[]',
  source_document_id uuid references public.documents (id) on delete set null,
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz not null default now()
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  name text not null,
  strength text,
  frequency text,
  timing text,
  duration text,
  instructions text,
  source_document_id uuid references public.documents (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.medicines (patient_id) where active;

create table public.bp_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  sys int not null check (sys between 60 and 260),
  dia int not null check (dia between 30 and 160),
  pulse int check (pulse between 20 and 250),
  source text not null default 'family' check (source in ('family', 'nurse', 'monitor')),
  recorded_by uuid default auth.uid() references auth.users (id),
  recorded_at timestamptz not null default now()
);
create index on public.bp_readings (patient_id, recorded_at desc);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider_org_id uuid not null references public.provider_orgs (id),
  service text not null,
  scheduled_at timestamptz not null,
  -- Snapshot for the provider, so they can find the home without reading patient records.
  patient_name text,
  address text,
  stage smallint not null default 0 check (stage between 0 and 4),
  tasks jsonb not null default '[{"t":"Check BP, pulse and oxygen","d":false},{"t":"Review medicines with family","d":false},{"t":"Assess walking and mobility","d":false},{"t":"Reinforce low-salt diet","d":false}]',
  vitals jsonb,
  note text,
  escalated boolean not null default false,
  share_records boolean not null default true,
  price_inr int check (price_inr >= 0),
  booked_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.visits (patient_id);
create index on public.visits (provider_org_id, scheduled_at);

-- Kept apart from visits so providers can never select it.
create table public.visit_codes (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  failed_attempts int not null default 0
);

/* ------------------------------------------------------------------ helpers */

create or replace function public.is_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from patient_members where patient_id = p and user_id = auth.uid());
$$;

create or replace function public.can_manage(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from patient_members where patient_id = p and user_id = auth.uid() and role in ('primary', 'backup'));
$$;

create or replace function public.my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select provider_org_id from profiles where id = auth.uid() and kind = 'provider';
$$;

-- A provider sees records only while the family shares them for an open visit.
create or replace function public.provider_can_see_records(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from visits v
    where v.patient_id = p and v.provider_org_id = public.my_org() and v.share_records and v.stage < 4
  );
$$;

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger visits_touch before update on public.visits for each row execute function public.touch_updated_at();

-- Every new auth user gets a family profile; providers upgrade via join_provider_org().
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone) values (new.id, new.phone) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

/* ------------------------------------------------------------------ row level security */

alter table public.provider_orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_members enable row level security;
alter table public.documents enable row level security;
alter table public.care_plans enable row level security;
alter table public.medicines enable row level security;
alter table public.bp_readings enable row level security;
alter table public.visits enable row level security;
alter table public.visit_codes enable row level security;

-- Start from nothing, then grant exactly what each table needs.
revoke all on all tables in schema public from anon, authenticated;

grant select (id, slug, name, verified) on public.provider_orgs to authenticated;
create policy orgs_read on public.provider_orgs for select to authenticated using (true);

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select on public.patients to authenticated;
grant update (full_name, age, sex, condition, hospital, discharged_on, treating_doctor, address, bp_limit_sys, bp_limit_dia) on public.patients to authenticated;
create policy patients_read on public.patients for select to authenticated
  using (public.is_member(id) or public.provider_can_see_records(id));
create policy patients_update on public.patients for update to authenticated
  using (public.can_manage(id)) with check (public.can_manage(id));

grant select on public.patient_members to authenticated;
create policy members_read on public.patient_members for select to authenticated using (public.is_member(patient_id));

grant select on public.documents to authenticated;
grant insert (patient_id, storage_path, kind, mime_type) on public.documents to authenticated;
create policy documents_read on public.documents for select to authenticated using (public.is_member(patient_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.can_manage(patient_id) and uploaded_by = auth.uid() and storage_path like patient_id::text || '/%');

grant select on public.care_plans to authenticated;
create policy plans_read on public.care_plans for select to authenticated
  using (public.is_member(patient_id) or public.provider_can_see_records(patient_id));

grant select on public.medicines to authenticated;
create policy meds_read on public.medicines for select to authenticated
  using (public.is_member(patient_id) or public.provider_can_see_records(patient_id));

grant select on public.bp_readings to authenticated;
grant insert (patient_id, sys, dia, pulse) on public.bp_readings to authenticated;
create policy bp_read on public.bp_readings for select to authenticated
  using (public.is_member(patient_id) or public.provider_can_see_records(patient_id));
create policy bp_insert_family on public.bp_readings for insert to authenticated
  with check (public.can_manage(patient_id) and source = 'family' and recorded_by = auth.uid());

grant select on public.visits to authenticated;
create policy visits_read on public.visits for select to authenticated
  using (public.is_member(patient_id) or provider_org_id = public.my_org());

grant select on public.visit_codes to authenticated;
create policy codes_read on public.visit_codes for select to authenticated
  using (exists (select 1 from public.visits v where v.id = visit_id and public.is_member(v.patient_id)));

/* ------------------------------------------------------------------ family functions */

create or replace function public.create_patient(p_full_name text default null, p_address text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into patients (full_name, address, created_by) values (p_full_name, p_address, auth.uid()) returning id into pid;
  insert into patient_members (patient_id, user_id, role) values (pid, auth.uid(), 'primary');
  return pid;
end $$;

-- Saves what the family confirmed on the review screen. Replaces the active medicine list.
-- p_document_id is null when the family typed the details in instead of uploading a document.
create or replace function public.confirm_plan(p_patient_id uuid, p_document_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid := p_patient_id; m jsonb;
begin
  if pid is null or not public.can_manage(pid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_document_id is not null and not exists (select 1 from documents where id = p_document_id and patient_id = pid) then
    raise exception 'document does not belong to this patient' using errcode = '42501';
  end if;

  update patients set
    full_name = coalesce(nullif(p->>'patient_name', ''), full_name),
    age = coalesce((p->>'age')::int, age),
    condition = coalesce(nullif(p->>'condition', ''), condition),
    hospital = coalesce(nullif(p->>'hospital', ''), hospital),
    discharged_on = coalesce((p->>'discharged_on')::date, discharged_on),
    treating_doctor = coalesce(nullif(p->>'treating_doctor', ''), treating_doctor),
    bp_limit_sys = coalesce((p->>'bp_limit_sys')::int, bp_limit_sys),
    bp_limit_dia = coalesce((p->>'bp_limit_dia')::int, bp_limit_dia)
  where id = pid;

  insert into care_plans (patient_id, follow_ups, limits, warning_signs, allergies, diet_activity, source_document_id, confirmed_by, confirmed_at)
  values (pid, coalesce(p->'follow_ups', '[]'), coalesce(p->'limits', '[]'), coalesce(p->'warning_signs', '[]'),
          coalesce(p->'allergies', '[]'), coalesce(p->'diet_activity', '[]'), p_document_id, auth.uid(), now())
  on conflict (patient_id) do update set
    follow_ups = excluded.follow_ups, limits = excluded.limits, warning_signs = excluded.warning_signs,
    allergies = excluded.allergies, diet_activity = excluded.diet_activity,
    source_document_id = excluded.source_document_id, confirmed_by = excluded.confirmed_by, confirmed_at = now();

  update medicines set active = false where patient_id = pid and active;
  for m in select * from jsonb_array_elements(coalesce(p->'medicines', '[]')) loop
    if coalesce(m->>'name', '') <> '' then
      insert into medicines (patient_id, name, strength, frequency, timing, duration, instructions, source_document_id)
      values (pid, m->>'name', m->>'strength', m->>'frequency', m->>'timing', m->>'duration', m->>'instructions', p_document_id);
    end if;
  end loop;

  if p_document_id is not null then update documents set status = 'confirmed' where id = p_document_id; end if;
end $$;

create or replace function public.book_visit(p_patient_id uuid, p_org_slug text, p_service text, p_scheduled_at timestamptz, p_share boolean, p_price_inr int)
returns uuid language plpgsql security definer set search_path = public as $$
declare vid uuid; org uuid; pt patients;
begin
  if not public.can_manage(p_patient_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  select id into org from provider_orgs where slug = p_org_slug;
  if org is null then raise exception 'unknown provider %', p_org_slug; end if;
  select * into pt from patients where id = p_patient_id;
  insert into visits (patient_id, provider_org_id, service, scheduled_at, patient_name, address, share_records, price_inr, booked_by)
  values (p_patient_id, org, p_service, p_scheduled_at, pt.full_name, pt.address, coalesce(p_share, true), p_price_inr, auth.uid())
  returning id into vid;
  insert into visit_codes (visit_id, code) values (vid, lpad((floor(random() * 10000))::int::text, 4, '0'));
  return vid;
end $$;

create or replace function public.set_visit_sharing(p_visit_id uuid, p_share boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from visits where id = p_visit_id and public.can_manage(patient_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update visits set share_records = p_share where id = p_visit_id;
end $$;

/* ------------------------------------------------------------------ provider functions */

create or replace function public.join_provider_org(p_join_code text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_role not in ('nurse', 'physio', 'coordinator', 'supplier') then raise exception 'bad role'; end if;
  select id into org from provider_orgs where join_code = p_join_code;
  if org is null then raise exception 'invalid join code' using errcode = '42501'; end if;
  update profiles set kind = 'provider', provider_role = p_role, provider_org_id = org where id = auth.uid();
  return org;
end $$;

-- Raises unless the caller works for the visit's provider organisation. Returns the visit.
create or replace function public.visit_for_provider(p_visit_id uuid) returns visits
language plpgsql stable security definer set search_path = public as $$
declare v visits;
begin
  select * into v from visits where id = p_visit_id;
  if v.id is null or v.provider_org_id is distinct from public.my_org() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public.visit_advance(p_visit_id uuid, p_stage smallint)
returns void language plpgsql security definer set search_path = public as $$
declare v visits := public.visit_for_provider(p_visit_id);
begin
  -- Travel (0 -> 1) and arrival (1 -> 2). Check-in (2 -> 3) needs the family's code.
  if not ((v.stage = 0 and p_stage = 1) or (v.stage = 1 and p_stage = 2)) then
    raise exception 'cannot move visit from stage % to %', v.stage, p_stage;
  end if;
  update visits set stage = p_stage where id = p_visit_id;
end $$;

create or replace function public.visit_check_in(p_visit_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v visits := public.visit_for_provider(p_visit_id); c visit_codes;
begin
  if v.stage <> 2 then raise exception 'visit is not waiting for check-in'; end if;
  select * into c from visit_codes where visit_id = p_visit_id for update;
  if c.failed_attempts >= 5 then raise exception 'too many wrong codes; ask the family to contact support'; end if;
  if c.code = p_code then
    update visits set stage = 3 where id = p_visit_id;
    return true;
  end if;
  update visit_codes set failed_attempts = failed_attempts + 1 where visit_id = p_visit_id;
  return false;
end $$;

create or replace function public.visit_record(p_visit_id uuid, p_tasks jsonb, p_vitals jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v visits := public.visit_for_provider(p_visit_id);
begin
  if v.stage <> 3 then raise exception 'visit is not in progress'; end if;
  update visits set tasks = coalesce(p_tasks, tasks), vitals = coalesce(p_vitals, vitals) where id = p_visit_id;
end $$;

create or replace function public.visit_escalate(p_visit_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v visits := public.visit_for_provider(p_visit_id);
begin
  if v.stage <> 3 then raise exception 'visit is not in progress'; end if;
  update visits set escalated = true where id = p_visit_id;
end $$;

create or replace function public.visit_complete(p_visit_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v visits := public.visit_for_provider(p_visit_id);
begin
  if v.stage <> 3 then raise exception 'visit is not in progress'; end if;
  update visits set
    stage = 4,
    note = coalesce(nullif(trim(p_note), ''), 'Readings recorded. Medicines reviewed. Family advised to continue the plan and log BP each morning.'),
    tasks = (select coalesce(jsonb_agg(jsonb_set(t, '{d}', 'true')), '[]') from jsonb_array_elements(tasks) t)
  where id = p_visit_id;
  if v.vitals ? 'sys' and v.vitals ? 'dia' then
    insert into bp_readings (patient_id, sys, dia, pulse, source, recorded_by)
    values (v.patient_id, (v.vitals->>'sys')::int, (v.vitals->>'dia')::int, nullif(v.vitals->>'pul', '')::int, 'nurse', auth.uid());
  end if;
end $$;

/* ------------------------------------------------------------------ function privileges */

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_patient(text, text),
  public.confirm_plan(uuid, uuid, jsonb),
  public.book_visit(uuid, text, text, timestamptz, boolean, int),
  public.set_visit_sharing(uuid, boolean),
  public.join_provider_org(text, text),
  public.visit_advance(uuid, smallint),
  public.visit_check_in(uuid, text),
  public.visit_record(uuid, jsonb, jsonb),
  public.visit_escalate(uuid),
  public.visit_complete(uuid, text)
to authenticated;
-- Helpers used inside RLS policies must be callable by the querying role.
grant execute on function public.is_member(uuid), public.can_manage(uuid), public.my_org(),
  public.provider_can_see_records(uuid), public.try_uuid(text) to authenticated;

/* ------------------------------------------------------------------ storage */

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

-- Files live at "<patient_id>/<file>". Members read; primary and backup contacts upload.
create policy documents_bucket_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member(public.try_uuid((storage.foldername(name))[1])));
create policy documents_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_manage(public.try_uuid((storage.foldername(name))[1])));

/* ------------------------------------------------------------------ realtime */

-- The family app watches its visits live while the nurse works.
alter publication supabase_realtime add table public.visits, public.bp_readings;
