# Home Konnect

Home-care app for families after a hospital discharge, plus the care-provider side of the same visits.
Built with **Expo (React Native) SDK 58**, so one codebase runs on iPhone and Android.

The app runs in two modes:

- **Demo mode** (default, no setup): all data is sample data in memory, as in the HTML prototype.
- **Live mode**: add Supabase keys to `.env` (see [`supabase/README.md`](supabase/README.md)) and you get real
  phone-OTP login, saved data, discharge summaries read by Claude, and nurse visits that sync live between the
  family's phone and the nurse's phone.

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

## Try the discharge-summary reader on your own files

Demo mode always shows the same sample summary. To see what Claude actually reads from a real document,
without setting up the backend, use the command below. It sends exactly the same request as the app's
server function and prints what the review screen would show, plus the cost.

1. Get an API key at https://console.anthropic.com and set it in Terminal:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Run it on a PDF, JPG or PNG (tip: drag the file into Terminal to paste its path):
   ```bash
   npm run read-summary -- ~/Downloads/discharge-summary.pdf
   ```
   Add `--json` at the end to see the raw result.

The file is sent to Anthropic's API. Use fictional or consented documents only.

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
| Discharge summary upload and reading by Claude, family review | Equipment orders and supplier rate card |
| Patient, medicines, care plan, BP readings saved | 24-hour monitor and monitoring desk |
| Booking a visit, record sharing on/off | Bills, claim pack, care circle |
| Nurse visit workflow with door code, synced live | Chat, calls, video doctor, pharmacy reorder |

Also still to do: multi-page photo upload (use a PDF for now), app icon and splash, and clinical sign-off on
the BP limits, SOS weights and monitor scoring.

## Checks

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
```

Backend tests are described in [`supabase/README.md`](supabase/README.md).
