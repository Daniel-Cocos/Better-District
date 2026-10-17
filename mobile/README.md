# Mobile

React Native app using Expo, TypeScript, Axios, and Zustand.

The app starts with a sign-in / create-account page. “Continue as guest” opens
the Map tab without contacting the backend. Profile shows the current session
and lets you sign out or return from guest mode to sign in. Sessions are in memory:
reloading the app signs you out, and passwords are never saved to disk.

Authentication uses the backend's `POST /users` and HTTP Basic `GET /users/me`
endpoints. Axios attaches the current account credentials to later API requests;
guest requests omit credentials. Use HTTPS for a deployed backend.

Start the backend with `make dev` in `backend/`. The Android emulator uses
`http://10.0.2.2:8000` to reach it by default. To override, copy `.env.example` to
`.env.local`, set `EXPO_PUBLIC_API_URL`, and restart Metro. For an iOS simulator,
use `http://127.0.0.1:8000`; for a phone use your computer's LAN address and bind
the backend to `0.0.0.0`. This URL is public app configuration, not a secret.

Pages use Expo Router. `src/app/auth.tsx` handles authentication, and the root
layout guards the `(tabs)` group based on the session. The tab bar stays hidden
on authentication screens. Profile links to the existing About page.

`src/components/navigation/AppTabs.tsx` owns the bottom bar's appearance and
navigation behavior. `src/navigation/tabs.ts` defines tab order, labels, and
active/inactive icons. Screens in `src/app/(tabs)/` only provide their content;
they never render or track the bar themselves. To add a tab, add its route file
and a definition in `tabs.ts`. Put future detail pages outside `(tabs)` or nest
them inside a tab's own stack. Map is the default tab; Android Back follows tab
visit history. The navigator handles safe areas and keeps labels below icons
even on wider screens. Map, Feed, and Notifications are placeholders for now.

After installing the router, restart Metro with `npm start -- --clear`.

From `mobile/`:

```sh
make install
make dev
```

Install Expo Go on your phone and scan the terminal QR code. Your phone and
computer should be on the same network.

The flake provides Node.js, npm, Watchman, and Android platform tools (ADB), and
sets `ANDROID_HOME` and `ANDROID_SDK_ROOT` for Expo. `package-lock.json` pins the app's
JavaScript dependencies, including React Native and Expo. No global Expo CLI is
needed. This setup runs on a physical phone through Expo Go; native builds need
additional Android SDK or macOS/Xcode tooling.

To open Expo Go over USB, enable USB debugging on your Android phone, connect it,
and accept the debugging authorization prompt. Run `make android`. You can check
the connection with `nix develop path:. --command adb devices`.
For an emulator on x86_64 Linux, run these in separate terminals from `mobile/`:

```sh
make emulator
# Once Android has finished booting, in the second terminal:
make android
```

The emulator target downloads its Android 36 Google APIs image on first use and
saves device state in `mobile/.android/`. The flake accepts the Android SDK
license for these packages. Android Studio is not required. On NixOS, hardware
acceleration requires virtualization enabled in firmware and KVM access. Load
`kvm-intel` or `kvm-amd` for your CPU and add your user to the `kvm` group in your
NixOS configuration if needed. Check access with `ls -l /dev/kvm`.

After changing the flake, restart Expo with `make dev` or `make android` so it
uses the updated Android tools path.

Like the backend, Make commands run inside the Nix development environment.
Run `make` to list commands, `make typecheck` to check TypeScript, and `make lint`
to run ESLint. `make test` checks auth requests, errors, and session transitions.
