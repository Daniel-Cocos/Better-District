{
  description = "React Native mobile development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };
        # Expo looks for adb under ANDROID_HOME/platform-tools.
        # Expo Go only needs platform tools, not a native build SDK.
        androidSdk = pkgs.linkFarm "expo-android-platform-tools" [
          { name = "platform-tools"; path = "${pkgs.android-tools}/bin"; }
        ];
      in {
        packages = pkgs.lib.optionalAttrs (system == "x86_64-linux") {
          emulator = pkgs.androidenv.emulateApp {
            name = "soton-android-emulator";
            deviceName = "soton";
            platformVersion = "36";
            abiVersion = "x86_64";
            systemImageType = "google_apis";
            androidUserHome = "\${PWD}/.android";
            configOptions = {
              "hw.keyboard" = "yes";
              "hw.ramSize" = "2048";
              "disk.dataPartition.size" = "4096M";
            };
          };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24 # Includes npm; Expo CLI comes from package.json.
            watchman
            android-tools
          ];

          ANDROID_HOME = "${androidSdk}";
          ANDROID_SDK_ROOT = "${androidSdk}";
        };
      });
}
