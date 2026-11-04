-- Security tests for the Home Konnect schema. Run with supabase/tests/run.sh.
-- Each check raises an exception on failure, so the script stops at the first broken rule.

\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
-- Runs a statement that must fail.
create or replace function pg_temp.must_fail(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'SECURITY FAIL: % (statement succeeded)', label;
exception when others then
  if sqlerrm like 'SECURITY FAIL%' then raise; end if;
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- Users
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000f001', '+919800000001'),  -- family 1
  ('00000000-0000-0000-0000-00000000f002', '+919800000002'),  -- family 2 (stranger)
  ('00000000-0000-0000-0000-00000000a001', '+919800000003'),  -- Sunrise nurse
  ('00000000-0000-0000-0000-00000000a002', '+919800000004');  -- CarePoint nurse

select pg_temp.check((select count(*) = 4 from public.profiles), 'profile created for every new user');

-- Family 1 sets up a patient
select pg_temp.as_user('00000000-0000-0000-0000-00000000f001');
select public.create_patient('Rameshbhai Patel', 'B-204, Shantigram') as p1 \gset
select pg_temp.check((select count(*) = 1 from public.patients), 'family sees own patient');
insert into public.documents (patient_id, storage_path, mime_type) values (:'p1', :'p1' || '/summary.pdf', 'application/pdf') returning id as d1 \gset
insert into storage.objects (bucket_id, name) values ('documents', :'p1' || '/summary.pdf');
select pg_temp.check(true, 'family uploads into own patient folder');
select pg_temp.must_fail(format($q$insert into public.documents (patient_id, storage_path) values (%L, 'someone-else/x.pdf')$q$, :'p1'), 'document path outside the patient folder');
select pg_temp.must_fail($q$insert into storage.objects (bucket_id, name) values ('documents', 'not-a-uuid/x.pdf')$q$, 'upload to a non-patient folder');
select pg_temp.must_fail(format($q$update public.profiles set kind = 'provider' where id = %L$q$, '00000000-0000-0000-0000-00000000f001'), 'family makes itself a provider');

select public.confirm_plan(:'p1', :'d1', jsonb_build_object(
  'patient_name', 'Rameshbhai Patel', 'age', 62, 'condition', 'Heart attack (NSTEMI), stent placed',
  'hospital', 'City Care Hospital', 'discharged_on', '2026-10-19', 'bp_limit_sys', 140, 'bp_limit_dia', 90,
  'medicines', jsonb_build_array(
     jsonb_build_object('name', 'Aspirin', 'strength', '75 mg', 'timing', 'Morning, after breakfast'),
     jsonb_build_object('name', 'Metoprolol', 'strength', '25 mg', 'timing', 'Morning and evening')),
  'warning_signs', jsonb_build_array(jsonb_build_object('text', 'Chest pain', 'source_page', 2))));
select pg_temp.check((select count(*) = 2 from public.medicines where active), 'confirmed plan saves medicines');
select pg_temp.check((select status = 'confirmed' from public.documents where id = :'d1'), 'document marked confirmed');
-- Typed in by hand, with no document
select public.confirm_plan(:'p1', null, jsonb_build_object('medicines', jsonb_build_array(
  jsonb_build_object('name', 'Aspirin', 'strength', '75 mg', 'timing', 'Morning'),
  jsonb_build_object('name', 'Metoprolol', 'strength', '25 mg', 'timing', 'Morning and night'),
  jsonb_build_object('name', 'Atorvastatin', 'strength', '40 mg', 'timing', 'Night'))));
select pg_temp.check((select count(*) = 3 from public.medicines where active), 'typed-in plan replaces medicines');
select public.create_patient('Other') as p_other \gset
select pg_temp.check((select count(*) = 1 from public.patient_members where patient_id = :'p_other'), 'second patient created');
select pg_temp.must_fail(format('select public.confirm_plan(%L, %L, %L::jsonb)', :'p_other', :'d1', '{}'), 'use another patient''s document');
insert into public.bp_readings (patient_id, sys, dia) values (:'p1', 128, 82);
select pg_temp.check((select source = 'family' from public.bp_readings limit 1), 'family logs BP as family');

-- A stranger sees nothing and can change nothing
select pg_temp.as_user('00000000-0000-0000-0000-00000000f002');
select pg_temp.check((select count(*) = 0 from public.patients), 'stranger cannot see the patient');
select pg_temp.check((select count(*) = 0 from public.medicines), 'stranger cannot see medicines');
select pg_temp.check((select count(*) = 0 from storage.objects), 'stranger cannot see uploaded files');
select pg_temp.must_fail(format('select public.confirm_plan(%L, %L, %L::jsonb)', :'p1', :'d1', '{}'), 'stranger confirms a plan');
select pg_temp.must_fail(format('select public.confirm_plan(%L, null, %L::jsonb)', :'p1', '{}'), 'stranger types in a plan');
select pg_temp.must_fail(format($q$insert into storage.objects (bucket_id, name) values ('documents', %L)$q$, :'p1' || '/evil.pdf'), 'stranger uploads into the patient folder');
select pg_temp.must_fail(format($q$select public.book_visit(%L, 'sunrise', 'Home nursing', now(), true, 650)$q$, :'p1'), 'stranger books a visit');

-- Providers join their organisations
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select pg_temp.must_fail($q$select public.join_provider_org('WRONG', 'nurse')$q$, 'join with a wrong code');
select public.join_provider_org('SUNRISE-DEV', 'nurse');
select pg_temp.check((select count(*) = 0 from public.patients), 'nurse sees no patient before a booking');
select pg_temp.check((select count(*) = 4 from public.provider_orgs), 'provider list is readable');
select pg_temp.must_fail('select join_code from public.provider_orgs', 'read organisation join codes');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a002');
select public.join_provider_org('CAREPOINT-DEV', 'nurse');

-- Family books Sunrise with sharing on
select pg_temp.as_user('00000000-0000-0000-0000-00000000f001');
select public.book_visit(:'p1', 'sunrise', 'Home nursing', now(), true, 650) as v1 \gset
select code as v1code from public.visit_codes where visit_id = :'v1' \gset
select pg_temp.check(:'v1code' ~ '^[0-9]{4}$', 'family can read its door code');
select pg_temp.must_fail(format($q$update public.visits set stage = 4 where id = %L$q$, :'v1'), 'family edits a visit directly');

-- Sunrise nurse works the visit
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select pg_temp.check((select count(*) = 1 from public.visits), 'nurse sees the booked visit');
select pg_temp.check((select count(*) = 1 from public.patients), 'nurse sees only the booked patient');
select pg_temp.check((select count(*) = 3 from public.medicines where active), 'nurse sees shared medicines');
select pg_temp.check((select count(*) = 0 from public.visit_codes), 'nurse cannot read the door code');
select pg_temp.must_fail(format('select public.visit_check_in(%L, %L)', :'v1', :'v1code'), 'check in before arriving');
select public.visit_advance(:'v1', 1::smallint);
select public.visit_advance(:'v1', 2::smallint);
select pg_temp.check(not public.visit_check_in(:'v1', case when :'v1code' = '0000' then '1111' else '0000' end), 'wrong door code is refused');
select pg_temp.check(public.visit_check_in(:'v1', :'v1code'), 'right door code checks in');
select public.visit_record(:'v1', null, '{"sys":146,"dia":88,"pul":76,"spo":96}'::jsonb);
select public.visit_escalate(:'v1');
select public.visit_complete(:'v1', 'BP a little high. Flagged to desk.');
select pg_temp.check((select stage = 4 and escalated from public.visits where id = :'v1'), 'visit completed and escalated');
select pg_temp.check((select count(*) = 0 from public.medicines), 'records access ends after the visit');

-- The other organisation sees nothing
select pg_temp.as_user('00000000-0000-0000-0000-00000000a002');
select pg_temp.check((select count(*) = 0 from public.visits), 'other provider cannot see the visit');
select pg_temp.must_fail(format('select public.visit_advance(%L, 1::smallint)', :'v1'), 'other provider moves the visit');

-- Family sees the nurse's reading; a visit without sharing hides records
select pg_temp.as_user('00000000-0000-0000-0000-00000000f001');
select pg_temp.check((select count(*) = 1 from public.bp_readings where source = 'nurse' and sys = 146), 'nurse reading reaches the family');
select public.book_visit(:'p1', 'sunrise', 'Home nursing', now() + interval '1 day', false, 650) as v2 \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select pg_temp.check((select count(*) = 1 from public.visits where id = :'v2'), 'nurse sees the unshared visit');
select pg_temp.check((select patient_name is not null and address is not null from public.visits where id = :'v2'), 'visit carries name and address for the nurse');
select pg_temp.check((select count(*) = 0 from public.patients), 'unshared visit hides patient records');

-- Guessing the code is limited
select public.visit_advance(:'v2', 1::smallint);
select public.visit_advance(:'v2', 2::smallint);
select pg_temp.as_admin();
update public.visit_codes set code = '1234' where visit_id = :'v2';
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select public.visit_check_in(:'v2', '0001'), public.visit_check_in(:'v2', '0002'), public.visit_check_in(:'v2', '0003'),
       public.visit_check_in(:'v2', '0004'), public.visit_check_in(:'v2', '0005') \gset ignored_
select pg_temp.must_fail(format('select public.visit_check_in(%L, %L)', :'v2', '1234'), 'check in after five wrong codes');

-- Anonymous users get nothing
select pg_temp.as_admin();
set role anon;
select pg_temp.must_fail('select * from public.patients', 'anonymous read');
reset role;

\echo ALL SECURITY TESTS PASSED
