# Better District

Better District connects residents with their council. Residents use the mobile app to
follow council plans on a map, vote and comment on them, and report local problems such as
potholes or graffiti with a photo and a pin. Council officers use the admin website to
moderate comments, review reports and see what residents think, with analysis from a
self-hosted AI model.

## Components

| Folder     | What it is                         | Stack                                       |
| ---------- | ---------------------------------- | ------------------------------------------- |
| `backend/` | REST API and database              | Python, FastAPI, SQLite                     |
| `web/`     | Admin website for council officers | React, TypeScript, Vite, MUI                |
| `mobile/`  | Resident app for Android and iOS   | React Native, Expo, TypeScript, Zustand     |

## Features

**Resident app**
- Map of council plans with details, deadlines, votes and threaded comments
- Report a problem: take or choose a photo, crop it, pick a category, place a pin, then
  review the report before submitting
- Edit or delete your own reports, including replacing the photo
- Profile with your report and comment history (reports for signed-in accounts only)
- Notifications for replies and submitted reports; sign in or continue as a guest

**Admin website**
- Overview, map and feed of plans and resident reports
- Flagged comments review queue
- Insights: per-plan and city-wide summaries of resident feedback
- Reports gallery: resident photos by category, ranked by estimated severity

Comment analysis and report severity run on a self-hosted [Ollama](https://ollama.com)
server (`OLLAMA_URL`), so resident data never leaves council machines.

## Getting started

Requirements: [Nix](https://nixos.org) (provides Python, Node.js and the Android tools)
and `curl`.

```sh
make dev     # backend, admin website, Android emulator and the app
make phone   # the same, on your Android phone over USB
```

Both seed the database with demo data and print the addresses when ready:

| Service       | Address                     | Sign in                                          |
| ------------- | --------------------------- | ------------------------------------------------ |
| Admin website | http://localhost:5173       | `admin` / `admin`                                |
| Backend API   | http://localhost:8000/docs  |                                                  |
| Mobile app    | Emulator or phone           | `alex@example.com` / `council-demo-2026`, or guest |

### Demo on an Android phone

1. On the phone, tap **Settings > About phone > Build number** seven times, then turn on
   **Developer options > USB debugging**.
2. Connect the phone with a data cable, unlock it and accept **Allow USB debugging**.
3. Run `make phone`.

The app opens in Expo Go (installed automatically). The backend and dev server are
forwarded over the cable with `adb reverse`, so no Wi-Fi setup is needed, and everything
done on the phone appears on the admin website. To use Wi-Fi and a QR code instead, run
`make dev EMULATOR=0`.

## Commands

| Command      | Description                                              |
| ------------ | -------------------------------------------------------- |
| `make dev`   | Run the full demo stack with the Android emulator        |
| `make phone` | Run the full demo stack on a USB-connected Android phone |
| `make logs`  | Follow the backend, website and emulator logs            |
| `make stop`  | Shut down the Android emulator                           |
| `make test`  | Run the backend, website and mobile checks               |

Each component also has its own `Makefile`; run `make` in a folder to list its commands.
See [`mobile/README.md`](mobile/README.md) for app details.
