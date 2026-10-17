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
# PHONE=1 (make phone) runs the app on an Android phone plugged in over USB. adb reverse
# carries the backend and Metro over the cable, so Wi-Fi and firewalls don't matter.
PHONE="${PHONE:-0}"
[[ "$PHONE" == 0 ]] || EMULATOR=0
METRO_PORT=8081

backend() { nix develop "path:$ROOT/backend" --command "$@"; }
node_env() { nix develop "path:$ROOT/mobile" --command "$@"; } # Node 24 + adb; web has no flake of its own

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

PIDS=()
cleanup() {
  trap - EXIT INT TERM HUP
  if ((${#PIDS[@]})); then
    step "Stopping the backend and website"
    for pid in "${PIDS[@]}"; do
      # Each service runs in its own session, so this also stops uvicorn's reloader and Vite's children
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    done
    rm -f "$ROOT/.dev/"*.pid
  fi
}
trap cleanup EXIT
# HUP too: closing the terminal must not leave the services running and holding their ports
trap 'exit 130' INT TERM HUP

# Start a long-running service from a directory, in the background, logging to .dev/logs/<name>.log.
# With setsid it gets its own session, so cleanup can stop its whole process group.
SETSID=()
command -v setsid >/dev/null && SETSID=(setsid)
start() {
  local name="$1" dir="$2"
  shift 2
  (cd "$dir" && exec ${SETSID[@]+"${SETSID[@]}"} "$@") >"$LOGS/$name.log" 2>&1 &
  PIDS+=("$!")
  echo "$!" >"$ROOT/.dev/$name.pid"
}

# Processes listening on a local TCP port (Linux ss, else lsof)
port_pids() {
  if command -v ss >/dev/null; then
    ss -Hltnp "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
  elif command -v lsof >/dev/null; then
    lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | sort -u
  fi
}
process_dir() {
  readlink "/proc/$1/cwd" 2>/dev/null || lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
}

# Stop services left behind by an earlier make dev (e.g. its terminal was closed), so this
# run can take their ports. Only processes started from this repo are touched.
stop_leftovers() {
  local file pid port dir found=0
  for file in "$ROOT/.dev/"*.pid; do
    [[ -f "$file" ]] || continue
    pid="$(cat "$file")"
    dir="$(process_dir "$pid")"
    if [[ "$dir" == "$ROOT" || "$dir" == "$ROOT/"* ]] && kill -- "-$pid" 2>/dev/null; then found=1; fi
    rm -f "$file"
  done
  for port in "$API_PORT" "$WEB_PORT"; do
    for pid in $(port_pids "$port"); do
      dir="$(process_dir "$pid")"
      if [[ "$dir" == "$ROOT" || "$dir" == "$ROOT/"* ]]; then
        kill -- "-$(ps -o pgid= -p "$pid" | tr -d ' ')" 2>/dev/null || kill "$pid" 2>/dev/null || true
        found=1
      fi
    done
  done
  if ((found)); then
    step "Stopped the backend and website left running by an earlier make dev"
    for _ in $(seq 20); do
      port_busy "$API_PORT" || port_busy "$WEB_PORT" || return 0
      sleep 0.5
    done
  fi
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
stop_leftovers
for port in "$API_PORT" "$WEB_PORT"; do
  if port_busy "$port"; then
    owner="$(for pid in $(port_pids "$port"); do ps -o pid=,args= -p "$pid"; done)"
    fail "Port $port is already in use${owner:+ by:
$owner
}${owner:-.}
Stop it and try again, or use another port with API_PORT=... / WEB_PORT=..."
  fi
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
if [[ "$PHONE" != 0 ]]; then
  # The phone's localhost is forwarded to this computer's by adb reverse below
  export EXPO_PUBLIC_API_URL="http://127.0.0.1:$API_PORT"
elif [[ "$EMULATOR" == 0 ]]; then
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

if [[ "$PHONE" != 0 ]]; then
  step "Connecting to your Android phone over USB"
  node_env adb start-server >/dev/null
  # The app opens on the first device Expo finds, so the emulator has to go
  for d in $(node_env adb devices | awk '/^emulator-/ {print $1}'); do
    echo "Shutting down $d so the app opens on your phone (make dev boots it again)."
    node_env adb -s "$d" emu kill >/dev/null 2>&1 || true
  done
  tries=60
  until SERIAL="$(node_env adb devices | awk '$2 == "device" && $1 !~ /^emulator-/ {print $1; exit}')" && [[ -n "$SERIAL" ]]; do
    if ((tries == 60)); then
      node_env adb devices | grep -q 'unauthorized' &&
        warn "Your phone is connected but hasn't allowed this computer yet: unlock it and accept \"Allow USB debugging\"." ||
        warn "No phone found. Plug it in with a data cable and turn on Developer options > USB debugging (see mobile/README.md)."
    fi
    tries=$((tries - 1))
    ((tries > 0)) || fail "Still no phone after a minute. Check the cable and USB debugging, then run make phone again."
    sleep 1
  done
  export ANDROID_SERIAL="$SERIAL"
  for port in "$API_PORT" "$METRO_PORT"; do
    node_env adb -s "$SERIAL" reverse "tcp:$port" "tcp:$port" >/dev/null
  done
  echo "Phone $SERIAL connected; it reaches the backend and Metro through the cable."
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

if [[ "$PHONE" != 0 ]]; then
  # --localhost serves the bundle on 127.0.0.1, which reaches the phone over adb reverse.
  # --android installs Expo Go on the phone if needed and opens the app in it.
  node_env npx expo start --android --localhost --port "$METRO_PORT"
elif [[ "$EMULATOR" != 0 ]]; then
  node_env npx expo start --android
else
  echo "The app will call the backend at $EXPO_PUBLIC_API_URL. Scan the QR code with Expo Go on the same Wi-Fi."
  node_env npx expo start
fi
