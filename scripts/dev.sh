#!/usr/bin/env bash
# One-command demo: backend + admin website + Android emulator + Expo, all linked up.
# Run through `make dev` at the repo root. Ctrl-C stops the backend, website and Metro;
# the emulator keeps running so the next `make dev` is quick (`make stop` shuts it down).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="$ROOT/.dev/logs"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
# EMULATOR=0 skips the emulator and shows a QR code for Expo Go on a phone instead
EMULATOR="${EMULATOR:-1}"

backend() { nix develop "path:$ROOT/backend" --command "$@"; }
node_env() { nix develop "path:$ROOT/mobile" --command "$@"; } # Node 24 + adb; web has no flake of its own

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

PIDS=()
cleanup() {
  trap - EXIT INT TERM
  if ((${#PIDS[@]})); then
    step "Stopping the backend and website"
    for pid in "${PIDS[@]}"; do
      # Each service runs in its own session, so this also stops uvicorn's reloader and Vite's children
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    done
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Start a long-running service from a directory, in the background, logging to .dev/logs/<name>.log.
# With setsid it gets its own session, so cleanup can stop its whole process group.
SETSID=()
command -v setsid >/dev/null && SETSID=(setsid)
start() {
  local name="$1" dir="$2"
  shift 2
  (cd "$dir" && exec ${SETSID[@]+"${SETSID[@]}"} "$@") >"$LOGS/$name.log" 2>&1 &
  PIDS+=("$!")
}

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null || (exec 3<>"/dev/tcp/::1/$1") 2>/dev/null; }

wait_for() {
  local name="$1" url="$2" log="$3" tries="${4:-120}"
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    tries=$((tries - 1))
    if ((tries <= 0)); then
      warn "$name didn't come up. Last lines of $log:"
      tail -n 30 "$log" >&2 || true
      exit 1
    fi
    sleep 1
  done
}

command -v nix >/dev/null || fail "Nix is required (the backend and mobile dev shells come from their flake.nix)."
command -v curl >/dev/null || fail "curl is required."
mkdir -p "$LOGS"
for port in "$API_PORT" "$WEB_PORT"; do
  port_busy "$port" && fail "Port $port is already in use. Stop whatever is using it (maybe another make dev) and try again."
done

step "Installing JavaScript dependencies where needed"
for app in web mobile; do
  if [[ ! -f "$ROOT/$app/node_modules/.package-lock.json" || "$ROOT/$app/package-lock.json" -nt "$ROOT/$app/node_modules/.package-lock.json" ]]; then
    (cd "$ROOT/$app" && node_env npm ci --no-audit --no-fund)
  else
    echo "$app: up to date"
  fi
done

step "Seeding the database with demo data"
(cd "$ROOT/backend" && backend python -m app.seed)

# A phone reaches the backend over the LAN; the emulator reaches the host's loopback as 10.0.2.2
API_HOST=127.0.0.1
if [[ "$EMULATOR" == 0 ]]; then
  API_HOST=0.0.0.0
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  [[ -n "$LAN_IP" ]] || LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [[ -n "$LAN_IP" ]] || fail "Couldn't find this computer's LAN address. Set EXPO_PUBLIC_API_URL yourself."
  export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://$LAN_IP:$API_PORT}"
fi

step "Starting the backend on port $API_PORT"
start backend "$ROOT/backend" nix develop "path:$ROOT/backend" --command \
  python -m uvicorn app.main:app --reload --timeout-graceful-shutdown 3 --host "$API_HOST" --port "$API_PORT"

step "Starting the admin website on port $WEB_PORT"
start web "$ROOT/web" nix develop "path:$ROOT/mobile" --command \
  npx vite --port "$WEB_PORT" --strictPort

wait_for "The backend" "http://127.0.0.1:$API_PORT/health" "$LOGS/backend.log"
echo "Backend ready: http://localhost:$API_PORT/docs"
wait_for "The admin website" "http://localhost:$WEB_PORT" "$LOGS/web.log"
echo "Admin website ready: http://localhost:$WEB_PORT (sign in as admin / admin)"

cd "$ROOT/mobile"
if [[ "$EMULATOR" != 0 ]]; then
  [[ "$(uname -sm)" == "Linux x86_64" ]] || fail "The project emulator only builds on x86_64 Linux. Start your own emulator/simulator, or run: make dev EMULATOR=0"
  [[ -e /dev/kvm ]] || warn "No /dev/kvm: the emulator will be very slow without hardware acceleration."

  if node_env adb devices | grep -q '^emulator-.*device$'; then
    step "Using the Android emulator that's already running"
  else
    step "Booting the Android emulator (the first run downloads the system image)"
    nix run "path:$ROOT/mobile#emulator" >"$LOGS/emulator.log" 2>&1 &
  fi
  node_env sh -c '
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" = 1 ]; do sleep 2; done
  '
  echo "Emulator ready."
fi

OLLAMA_URL="${OLLAMA_URL:-http://100.100.79.70:11434}"
if curl -fsS -m 3 -o /dev/null "$OLLAMA_URL/api/tags" 2>/dev/null; then
  OLLAMA_STATUS="$OLLAMA_URL (reachable)"
else
  OLLAMA_STATUS="$OLLAMA_URL (NOT reachable: feedback summaries will show vote numbers only)"
fi

step "Ready to demo"
cat <<EOF
  Admin website   http://localhost:$WEB_PORT   (admin / admin)
  Backend API     http://localhost:$API_PORT/docs
  App accounts    alex@example.com or sam@example.com, password council-demo-2026, or continue as a guest
  Comment model   $OLLAMA_STATUS
  Logs            $LOGS  (make logs)

Starting Expo. Press Ctrl-C to stop everything except the emulator.
EOF

if [[ "$EMULATOR" != 0 ]]; then
  node_env npx expo start --android
else
  echo "The app will call the backend at $EXPO_PUBLIC_API_URL. Scan the QR code with Expo Go on the same Wi-Fi."
  node_env npx expo start
fi
