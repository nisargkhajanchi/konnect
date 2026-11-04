# Home Konnect

Home-care app for families after a hospital discharge, plus the care-provider side of the same visits.
Built with **Expo (React Native) SDK 58**, so one codebase runs on iPhone and Android.

The app runs in two modes:

- **Demo mode** (default, no setup): all data is sample data in memory, as in the HTML prototype.
- **Live mode**: add Supabase keys to `.env` (see [`supabase/README.md`](supabase/README.md)) and you get real
  phone-OTP login, saved data, discharge summaries read automatically, and nurse visits that sync live between
  the family's phone and the nurse's phone.

**Reading discharge summaries needs no AI and no API key.** A built-in parser reads the text of digital PDFs
(what most hospital systems produce): patient, diagnosis, each medicine with strength and timing ("1-0-1",
"BD", "SOS for chest pain"), follow-up, limits, warning signs and allergies. Anything it isn't sure of is
flagged for the family to confirm. Scans and photos have no text, so the family types the details in.

## Run it on your iPhone (no Mac needed)

1. Install **Expo Go** from the App Store.
2. On your computer (Node 20+):
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone camera. The app opens in Expo Go.

Building a real App Store app later uses EAS in the cloud (`npx eas-cli@latest build -p ios`), which needs
an Apple Developer account. No Xcode required.

## Try the discharge-summary reader on your own PDFs

In demo mode the app shows a sample summary. To see what the parser reads from a real PDF, with nothing to
set up, run this in the project folder (tip: drag the file into Terminal to paste its path):

```bash
npm run read-summary -- ~/Downloads/discharge-summary.pdf
```

It runs the same code as the server, on your computer only: nothing is uploaded anywhere. Add `--text` to see
the text it found in the PDF, or `--json` for the raw result. If something is missed, send the `--text`
output so the parser can be taught that hospital's layout.

## What's in the app

| Side | Screens |
|---|---|
| Start | Choose family or care provider |
| Family | OTP login → add discharge summary (camera / PDF) → check what we read → **Today**, **Find care**, **Visits**, **Health** (vitals, medicines, records), **More** |
| Family, from those | Providers (4 sorts) → provider → 3-step booking → confirmed · live visit tracker · care plan · **SOS** triage (real 108 dial) · equipment rent/buy → order · 24-hour monitor (plans, 5-step setup, live view with alerts) · doctor summary (PDF / share) · bills and claims · care circle |
| Provider | Sign-in with role · Nurse/Physio day list · visit workflow (door code, checklist, readings, flag, complete) · monitoring desk sorted by risk · desk patient actions · supplier rate card and order fulfilment |

Both sides share one store (`src/state/store.ts`). In live mode the store loads from and writes to Supabase,
and visits stream in real time, so the nurse's progress shows on the family's phone as it happens.

## Project layout

```
src/
  app/            Screens (Expo Router: every file is a route)
    (tabs)/       Family tab bar: today, care, visits, health, more
    pro/          Care-provider screens
  components/     Shared UI (ui.tsx), charts, tiles
  data/demo.ts    Demo content and the core types (Patient, CarePlan, Med)
  lib/            Supabase client and every backend call (api.ts)
  logic/          Pure rules: pricing, triage, BP/monitor scoring, plan building, doctor summary
  state/store.ts  App state (zustand); demo or live
  theme.ts        Colours and fonts from the prototype
supabase/         Database migration, security tests, and the read-summary function (see its README)
```

## Changes from the HTML prototype

- Today's plan, medicine names and "running low" are built from the **confirmed** medicine list, not fixed text.
- "Next" message after the nurse visit points to the follow-up, not the finished visit.
- Today's completed visit is billed in Bills and counted in the doctor summary.
- All user text in the doctor summary is HTML-escaped.
- Provider roles behave differently: Physio sees sessions, Coordinator lands on the monitoring desk, Supplier on the rate card.
- Monitor history scrolls over time instead of only rewriting the last point.
- Native iOS pieces: system tab bar, swipe-back, haptics, camera and document pickers, share sheet, PDF via the print system.

## What is live vs still demo

| Live (with Supabase) | Still demo in both modes |
|---|---|
| Phone OTP login (family and provider) | Provider list, prices and ratings |
| Discharge summary upload, automatic reading of PDFs, typing in, family review | Equipment orders and supplier rate card |
| Patient, medicines, care plan, BP readings saved | 24-hour monitor and monitoring desk |
| Booking a visit, record sharing on/off | Bills, claim pack, care circle |
| Nurse visit workflow with door code, synced live | Chat, calls, video doctor, pharmacy reorder |

Also still to do: app icon and splash, and clinical sign-off on the BP limits, SOS weights and monitor scoring.
Optional: reading photos and scans automatically would need either on-phone text recognition (needs a full app
build, not Expo Go) or an AI service; the server already supports Claude for this if `ANTHROPIC_API_KEY` is set.

## Checks

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
```

Backend tests are described in [`supabase/README.md`](supabase/README.md).
