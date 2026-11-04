-- Development seed. Providers join with the code below from the app's provider sign-in.
-- Replace the join code before any real use.
insert into public.provider_orgs (slug, name, join_code, verified) values
  ('sunrise', 'Sunrise Home Nursing', 'SUNRISE-DEV', true),
  ('carepoint', 'CarePoint Homecare', 'CAREPOINT-DEV', true),
  ('nightingale', 'Nightingale Nurses Co-op', 'NIGHTINGALE-DEV', true),
  ('vitality', 'Vitality Home Health', 'VITALITY-DEV', true)
on conflict (slug) do nothing;
