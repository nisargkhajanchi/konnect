# Home Konnect backend (Supabase)

What's here:

| Path | What it does |
|---|---|
| `migrations/20261104000000_init.sql` | Tables, row-level security, storage bucket, realtime, and the functions the app calls (`book_visit`, `visit_check_in`, …) |
| `seed.sql` | Four provider organisations with **development** join codes |
| `functions/read-summary/` | Edge function: reads an uploaded discharge summary with Claude (`claude-opus-5-5`) and returns structured fields |
| `functions/_shared/extraction.ts` | The extraction schema, prompt and validation, shared with the app |
| `tests/` | Security tests for the schema (run on plain Postgres) |

## Who can see what

- A family sees only the patient they belong to (`patient_members`). Primary and backup contacts can upload, confirm the plan, log BP and book. Viewers can only read.
- A provider sees visits booked with **their** organisation. They see the patient's records (condition, medicines, allergies, plan) only while the family has sharing on **and** the visit is still open. Completing the visit ends access.
- Providers never see the door code. They check in through `visit_check_in`, which locks after 5 wrong codes.
- All visit changes go through checked database functions; nobody can edit a visit row directly.
- Uploaded files live in a private bucket under `<patient_id>/…`.

## Set up a project (about 20 minutes)

You need: a Supabase account, an Anthropic API key, and an SMS provider for OTPs (Twilio, MessageBird, Vonage or Textlocal are supported by Supabase).

1. **Create the project** at supabase.com. Pick the **Mumbai (ap-south-1)** region so patient data stays in India.
2. **Link this folder** (from the repo root):
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
3. **Create the database**:
   ```bash
   npx supabase db push
   ```
   Then open `seed.sql`, **change the join codes**, and run it in the dashboard's SQL editor.
4. **Phone login**: Dashboard → Authentication → Sign In / Providers → Phone. Turn it on and connect your SMS provider.
   While testing, add test numbers with fixed OTPs on the same page, so no SMS is sent.
5. **Claude key for the reader**:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
6. **Deploy the reader**:
   ```bash
   npx supabase functions deploy read-summary
   ```
7. **Point the app at it**: copy `.env.example` to `.env` in the repo root and fill in the project URL and anon key. Restart `npx expo start`.

To add a nurse: they sign in from "I'm a care provider" with their phone, then enter their organisation's join code once.

## Tests

```bash
# Schema security (needs a local Postgres 15+; any empty server works)
PGHOST=localhost PGUSER=postgres supabase/tests/run.sh

# Extraction rules + the reader against fake Supabase and fake Claude (needs Deno 2)
deno test --config supabase/functions/read-summary/deno.json -A supabase/functions/_shared/ supabase/functions/read-summary/
```

## Before real patients use it

- **Privacy law**: discharge summaries are sensitive health data under India's DPDP Act 2023. Get legal advice on consent wording, data retention, and processing by Anthropic and Supabase as data processors.
- **Anthropic data handling**: check your Anthropic organisation's data retention settings for API traffic containing health information.
- **Clinical sign-off**: the BP limit default (140/90), SOS weights and monitor scoring in the app are demo values.
- **Join codes**: replace the development codes, and add a proper provider verification step before onboarding real organisations.
