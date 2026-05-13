# APK Build

Use one command from the workspace root:

```powershell
pnpm.cmd run mobile:apk
```

Direct mobile command:

```powershell
pnpm.cmd --dir artifacts\mobile run apk
```

Clean rebuild:

```powershell
pnpm.cmd --dir artifacts\mobile run apk:clean
```

Output files:

- `artifacts/mobile/dist/ResetFlow-latest.apk`
- `artifacts/mobile/dist/ResetFlow-<version>-<versionCode>-release.apk`

Before shipping an update:

1. Increase `expo.version` and `expo.android.versionCode` in `artifacts/mobile/app.json`.
2. Run the APK command again.
3. Distribute the new file from `artifacts/mobile/dist/`.

Current note:

- Release builds are still signed with the debug keystore from `artifacts/mobile/android/app/build.gradle`. That is fine for local installs, but not for Play Store release signing.
