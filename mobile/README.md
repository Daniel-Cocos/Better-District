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
even on wider screens. Notifications is a placeholder for now.

Feed uses the shared events store with pull-to-refresh and retry support. Tap
an event card to open the Map tab with `?eventId=...`, zoom to that pin, and show
its existing details/comments panel. The camera keeps the marker in the exposed
map strip beside the panel. Closing the panel clears the selection; returning
to Feed preserves its scroll position. Feed and Map both refresh on focus.

Map uses MapLibre with OpenFreeMap Positron tiles based on OpenStreetMap data, centered
on Southampton. The light monochrome style keeps street labels with less visual
clutter. Pan, pinch zoom, zoom controls, and visible map attribution are
included. It needs internet access but no API key. The location button asks for
foreground location permission on tap and centers the map on a fresh position,
with a position marker and accuracy circle. It does not track in the background.
Denied permission, disabled location services, and timeouts leave the map usable.
For emulator testing, set a simulated position in the emulator's Location controls.
`src/components/maps/OpenStreetMap.tsx` owns loading/retry and external links;
`mapDocument.ts` owns the basemap and initial view. MapLibre is pinned to 5.8.0,
using its bundled worker for Android WebView compatibility.
`MapControls.tsx` groups zoom in, zoom out, and location at the bottom-right.
Map credits are available through the compact attribution button at bottom-left.
Tile requests use the WebView's normal HTTP cache and
identify the app as BetterDistrict. Events load from `GET /events` when the Map tab
opens or regains focus. Tap a pin to open a side panel with its title, description,
closing/action deadline, and conversation. The map remains visible at the left
and the bottom tabs remain accessible. Close with X, the map backdrop, or Android
Back. The composer posts to `POST /events/{id}/comments`; guest comments are
anonymous and signed-in comments use the active account. Drafts are retained
when posting fails. Comments load separately for each event with retry support.
Deadlines use your device's timezone. Passed deadlines are labeled closed;
legacy events with no deadline say “Closing time not set”. API requests
use native Axios and pass marker data to the WebView; the embedded map never
receives account credentials. A failed request leaves the basemap usable and
offers Retry. The initial view fits the events without moving the camera on
subsequent refreshes.

For laptop + Android emulator development, run `make seed` (if needed) and
`make dev` from `backend/`, then `make android` from `mobile/`. The emulator's
`10.0.2.2` address reaches the laptop's loopback interface, so the backend can
keep its default `127.0.0.1:8000` binding. Native requests do not need browser
CORS configuration. The five seeded events already have Southampton coordinates;
the seed command refreshes those five demo event descriptions, coordinates, and
demo comment text while preserving votes and accounts. These are fictional
Common, Portswood, Riverside, Old Town, and Mayflower Park community events.

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

### Demo on your own Android phone (USB)

The quickest way to put the app on a real phone, with no APK and no Wi-Fi setup:

1. On the phone, open Settings > About phone and tap **Build number** seven times
   to unlock Developer options. Then turn on Developer options > **USB debugging**
   (menu names vary by manufacturer).
2. Plug the phone into the computer with a data cable (not a charge-only one),
   unlock it, and accept **Allow USB debugging** (tick "Always allow").
3. From the repo root run `make phone`.

This seeds and starts the backend and admin website like `make dev`, then runs
`adb reverse` so the phone's `127.0.0.1:8000` (backend) and `127.0.0.1:8081`
(Metro) go through the cable to the computer. Expo installs Expo Go on the phone
if needed and opens the app. Firewalls and Wi-Fi networks don't matter, and the
admin website at http://localhost:5173 uses the same backend, so reports and
comments made on the phone show up there. Keep the cable plugged in during the
demo. A running project emulator is shut down first so the app opens on the
phone. Check the connection with `nix develop path:. --command adb devices`: the
phone must show `device`, not `unauthorized`. Without a cable,
`make dev EMULATOR=0` serves the app over Wi-Fi with a QR code instead.
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

Comments support likes/dislikes, editing, deletion, and a profile history. Only the author can edit or delete a comment. Authors can see their vote counts but cannot like or dislike their own comments. Signed-in ownership follows the account; anonymous ownership uses a persistent device cookie. Anonymous comments created before ownership was added cannot be claimed.


The **Report** tab supports taking/uploading a photo, a title and description,
and a location chosen by tapping/dragging a map pin (GPS is optional). Your own issues appear on the map alongside council projects. Other residents’
issues are excluded. Tap an issue marker to open its details. Successful
submissions also create a notification. Failed submissions retain the current draft in memory. The
backend must include the community issue API and schema.

After installing `expo-image-picker`, rebuild an existing development client to
include the camera/photo module and permission configuration. Test camera capture
on a physical device; the iOS simulator has no camera.
