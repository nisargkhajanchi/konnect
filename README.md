# Home Konnect

Home-care app for families after a hospital discharge, plus the care-provider side of the same visits.
Built with **Expo (React Native) SDK 58**, so one codebase runs on iPhone and Android.

This is a port of the HTML prototype to a real app. **All data is demo data** held in memory: nothing is saved
between launches and nothing talks to a server yet.

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

## What's in the app

| Side | Screens |
|---|---|
| Start | Choose family or care provider |
| Family | OTP login → add discharge summary (camera / PDF) → check what we read → **Today**, **Find care**, **Visits**, **Health** (vitals, medicines, records), **More** |
| Family, from those | Providers (4 sorts) → provider → 3-step booking → confirmed · live visit tracker · care plan · **SOS** triage (real 108 dial) · equipment rent/buy → order · 24-hour monitor (plans, 5-step setup, live view with alerts) · doctor summary (PDF / share) · bills and claims · care circle |
| Provider | Sign-in with role · Nurse/Physio day list · visit workflow (door code, checklist, readings, flag, complete) · monitoring desk sorted by risk · desk patient actions · supplier rate card and order fulfilment |

Both sides share one store (`src/state/store.ts`), so when the nurse completes a visit the family sees it
immediately, just like the prototype's two-sided demo.

## Project layout

```
src/
  app/            Screens (Expo Router: every file is a route)
    (tabs)/       Family tab bar: today, care, visits, health, more
    pro/          Care-provider screens
  components/     Shared UI (ui.tsx), charts, tiles
  data/demo.ts    All demo content. Replace with API calls.
  logic/          Pure rules: pricing, triage, BP/monitor scoring, doctor summary builder
  state/store.ts  App state (zustand)
  theme.ts        Colours and fonts from the prototype
```

## Changes from the HTML prototype

- Today's plan, medicine names and "running low" are built from the **confirmed** medicine list, not fixed text.
- "Next" message after the nurse visit points to the follow-up, not the finished visit.
- Today's completed visit is billed in Bills and counted in the doctor summary.
- All user text in the doctor summary is HTML-escaped.
- Provider roles behave differently: Physio sees sessions, Coordinator lands on the monitoring desk, Supplier on the rate card.
- Monitor history scrolls over time instead of only rewriting the last point.
- Native iOS pieces: system tab bar, swipe-back, haptics, camera and document pickers, share sheet, PDF via the print system.

## Not done yet (needs a backend or decisions)

- **Reading the discharge summary is simulated.** The review screen always shows the sample extraction.
- Real OTP login, saved data, provider accounts, payments, chat/calls, video doctor, pharmacy orders.
- App icon and splash are still Expo defaults.
- Clinical rules (BP limits, SOS weights, monitor scoring) are demo values and need clinical sign-off.

## Checks

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
```
