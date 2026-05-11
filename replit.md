# ResetFlow

A minimal, offline-first mobile app for daily routines, temporary tasks, and study tracking with Pomodoro. All data lives on-device — no account, no cloud.

## Run & Operate

- Mobile (Expo): scan the QR code from the preview pane URL bar with Expo Go (Android)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo + Expo Router (file-based routing), React Native
- State: React Context + AsyncStorage (fully offline)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter
- Icons: @expo/vector-icons (Feather)
- API: Express 5 (backend stub, not used by mobile)

## Where things live

- `artifacts/mobile/` — Expo app (Android-first)
- `artifacts/mobile/app/(tabs)/` — 4 tab screens: Routine, Study, Stats, Settings
- `artifacts/mobile/context/RoutineContext.tsx` — daily tasks + temp tasks state
- `artifacts/mobile/context/StudyContext.tsx` — subjects, study sessions, Pomodoro timer
- `artifacts/mobile/components/` — TaskCard, SubjectCard, PomodoroDisplay, modals
- `artifacts/mobile/constants/colors.ts` — design tokens (indigo/navy palette)
- `artifacts/api-server/` — Express API server (healthz only)

## Architecture decisions

- Fully offline: all data stored with AsyncStorage, no network calls from the app
- Daily reset: on app launch, checks if `@resetflow/daily_reset_date` !== today; if so, resets all daily task `isDone` to false
- Temp tasks: stored with a `date` field (YYYY-MM-DD); only today's date is shown — old ones naturally disappear
- Pomodoro: ref-based timer using `Date.now()` deltas for accuracy (not tick-counting); partial sessions (>= 1 min) are saved on stop
- 4 AsyncStorage keys: `@resetflow/daily_tasks`, `@resetflow/daily_reset_date`, `@resetflow/temp_tasks`, `@resetflow/subjects`, `@resetflow/study_sessions`, `@resetflow/pomodoro_settings`

## Product

- **Routine tab**: Daily tasks (auto-reset at midnight) + Today's Tasks (temporary, disappear next day). One-tap checkbox with haptic feedback. Long-press to delete or move temp tasks to tomorrow.
- **Study tab**: Subject-based Pomodoro timer. Start/pause/stop with partial session saving. Active timer shown at top with progress bar.
- **Stats tab**: Daily/weekly/all-time totals, 7-day bar chart, per-subject breakdown with progress bars, recent sessions list.
- **Settings tab**: Configure Pomodoro work/break duration, export all data as JSON, reset all data.

## User preferences

- Android-first
- Minimal, offline-first — no backend or cloud for app data
- Fast one-tap checkbox as the primary interaction

## Gotchas

- Web preview has font-rendering artifacts in Expo Go web mode — test on real Android device via QR code
- Do NOT add a database or backend for routine/study data — use AsyncStorage only
- Pomodoro timer uses setInterval(500ms) + Date.now() deltas — do not switch to tick-counting approach
