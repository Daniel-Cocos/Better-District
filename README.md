<p align="center">
  <img src="assets/logo.png" alt="Better District" width="280">
</p>

# Better District

A map-based platform connecting residents with their council. Residents explore local plans, vote and comment, and report problems with photos and map pins. Council officers manage projects, moderate feedback and review AI-assisted insights through an admin website.

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/React_Native_/_Expo-000020?logo=expo&logoColor=white)
![Nix](https://img.shields.io/badge/Nix-5277C3?logo=nixos&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?logo=ollama&logoColor=white)

**Local prototype with demo data.** Includes a separate research benchmark evaluating whether models can filter unhelpful consultation comments without losing useful feedback.

## Project walkthrough

[![Watch the Better District project walkthrough on YouTube](https://img.youtube.com/vi/gBwpKXgnWPM/hqdefault.jpg)](https://youtu.be/gBwpKXgnWPM)

[Watch the project walkthrough](https://youtu.be/gBwpKXgnWPM). Select the thumbnail to play on YouTube.

## Components

| Component | Purpose | Technologies |
| --- | --- | --- |
| [Backend](backend/README.md) | API, accounts, projects, reports and analysis | Python, FastAPI, SQLite, Ollama |
| [Admin website](web/README.md) | Project management, moderation and feedback insights | React, TypeScript, Vite, MUI, Leaflet |
| [Resident app](mobile/README.md) | Maps, votes, threaded comments and photo reports | React Native, Expo, TypeScript, Zustand |
| [Research](research/README.md) | Consultation data extraction and reproducible model evaluation | LightGBM, DeBERTa, Qwen, DSPy, Laya |

## Run the demo

Install [Nix](https://nixos.org/download/) with flakes enabled, plus Git, Make and `curl`. Run commands from the repository root. The first run downloads development tools and installs JavaScript dependencies.

```sh
make dev               # API, admin website and Android app (x86_64 Linux emulator)
make phone             # Same stack on an Android phone connected over USB
make dev EMULATOR=0    # Same stack with an Expo Go QR code for a phone on Wi-Fi
```

For USB, enable **Developer options → USB debugging**, connect a data cable and accept the phone's debugging prompt. For Wi-Fi, install Expo Go and use the same network as your computer.

| Service | Address | Demo sign-in |
| --- | --- | --- |
| Admin website | http://localhost:5173 | `admin` / `admin` |
| API documentation | http://localhost:8000/docs | Interactive endpoint reference |
| Resident app | Emulator or phone | `alex@example.com` / `council-demo-2026`, or continue as guest |

The launcher seeds demo data. **Ctrl+C** stops the API, website and Expo; `make stop` shuts down the Android emulator. Use `make logs` to follow service logs and `make test` to run backend, website and mobile checks.

### Run components separately

Use a separate terminal for each service. These commands start from the repository root:

```sh
# Backend
make -C backend seed
make -C backend dev
```

```sh
# Admin website (requires the backend)
cd web
nix develop path:../mobile --command npm ci
nix develop path:../mobile --command npm run dev
```

```sh
# Resident app (requires the backend)
make -C mobile install
make -C mobile dev       # Expo Go QR code
# Or: make -C mobile android   # Running Android emulator/device
# Or: make -C mobile ios       # iOS simulator on macOS with Xcode
```

The Android emulator uses `http://10.0.2.2:8000`. For the iOS simulator, set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` in `mobile/.env.local`. For a Wi-Fi phone, use your computer's LAN address and bind the API to `0.0.0.0`; the full demo launcher configures this automatically. See the [mobile guide](mobile/README.md) for device setup.

**AI insights:** configure `OLLAMA_URL` and optionally `OLLAMA_MODEL` before starting the backend to use your own Ollama server. Without a reachable model, the demo still shows vote counts. See [backend configuration](backend/README.md#feedback-summaries) for analysis settings.

## Research: results and verdict

The benchmark compares five model approaches and two baselines for identifying useful consultation feedback. The expanded dataset contains **310 comments**; the held-out challenge test contains **40 comments: 20 useful and 20 unhelpful**. Labels are AI-generated references, not verified human ground truth.

| Approach | Useful kept / 20 | Unhelpful filtered / 20 | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Keep everything | 20 | 0 | 50.0% | 100.0% | 66.7% |
| Keyword rule | 4 | 19 | 80.0% | 20.0% | 32.0% |
| LightGBM | 15 | 4 | 48.4% | 75.0% | 58.8% |
| DeBERTa-v3-small | 20 | 0 | 50.0% | 100.0% | 66.7% |
| Qwen3 1.7B, zero-shot | 9 | 16 | 69.2% | 45.0% | 54.5% |
| Qwen3 1.7B, DSPy | 20 | 1 | 51.3% | 100.0% | 67.8% |
| Laya | 12 | 7 | 48.0% | 60.0% | 53.3% |

**Verdict: no reliable all-round filter emerged.** Zero-shot Qwen had the highest accuracy (62.5%) but lost 11 of 20 useful comments. DSPy had the highest F1 and retained every useful comment, yet removed only one unhelpful comment. This small, selected test does not establish a general model ranking or justify automatically discarding resident feedback. Next steps are human-checked labels, more consultation topics, an unseen-consultation test and an “unsure → keep” option.

**First trial — 24 comments (22 useful, two unhelpful)**

![First trial: model precision and recall](research/benchmark/previous/figures/precision_recall.png)

**Expanded trial — 40 comments (20 useful, 20 unhelpful)**

![Expanded trial: model precision and recall](research/benchmark/results/figures/precision_recall.png)

The trials use different selected samples and class proportions; precision and accuracy are not directly comparable between them. [Full findings](research/benchmark/results/findings.md) · [Metrics](research/benchmark/results/comparison.csv) · [Per-comment predictions](research/benchmark/results/case_predictions.csv) · [Research methodology](research/README.md)

### Reproduce the research

Run from `research/` with Nix flakes enabled. Model runs require model downloads; the Qwen experiments use Ollama at `http://localhost:11434` with `qwen3:1.7b` installed and the server running.

```sh
cd research
make data-offline   # Extract consultation data from bundled PDFs (make data downloads sources)
make prepare        # Rebuild the labelled benchmark dataset and frozen split
make fetch-model    # Download DeBERTa assets
make benchmark      # Run all five models and both baselines
make analysis       # Regenerate comparison reports and graphs
make test           # Run research tests
```

To regenerate graphs from the checked-in results alone, run `make -C research analysis`. Experiment settings live in [`research/experiments/`](research/experiments/); see the [research guide](research/README.md) for sources, evaluation details and limitations.
