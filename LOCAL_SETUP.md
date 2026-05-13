# Local Setup

This project can run without Replit.

## Install

```powershell
pnpm.cmd install
```

## Start the mobile app locally

```powershell
pnpm.cmd run mobile:dev
```

That starts standard Expo development mode.

Legacy Replit-specific dev mode is still available if needed:

```powershell
pnpm.cmd run mobile:dev:replit
```

## Build an Android APK

```powershell
pnpm.cmd run mobile:apk
```

Clean rebuild:

```powershell
pnpm.cmd run mobile:apk:clean
```

APK build notes:

- The APK builder uses a short staging path on Windows to avoid native build path-length failures.
- Output is copied to `artifacts/mobile/dist/`.
- If you change app versioning, update `artifacts/mobile/app.json` first.

## Replit status

The repository still contains Replit files such as `.replit` and `replit.md`, but the local development and APK workflow no longer depend on them.
