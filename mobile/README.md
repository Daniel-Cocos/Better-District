# Mobile

Minimal React Native app using Expo and TypeScript. Displays `hello worls`.

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
to run ESLint.
