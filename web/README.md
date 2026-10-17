# Southampton City Council — Admin website

React + MUI (Vite) admin portal for council staff. It talks to the **Better District** FastAPI
backend (`../backend` in this repo) through axios; in development
Vite proxies `/api/*` to `http://localhost:8000` and strips the `/api` prefix.

## Run it

1. Start the backend (see `../backend/README.md`), seeding it first:

   ```sh
   cd ../backend
   .venv/Scripts/python -m app.seed
   .venv/Scripts/python -m uvicorn app.main:app --reload
   ```

2. Start this site:

   ```sh
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 and sign in with `admin@southampton.gov.uk` / `council-admin-2026`.

## Pages

- `/login` — staff sign-in
- `/` — overview: stats, map preview, latest comments, drafts, published projects
- `/projects/new` — 5-step project wizard (Basics → Location → Documents → Permanent & changeable →
  Questions & comments). Save as a draft at any step; `?draft=<id>` resumes one.

## Layout

- `src/api/` — axios client (`client.ts`: token + 401 handling) and typed endpoint calls
- `src/auth/AuthContext.tsx` — signed-in admin state, session restore on reload
- `src/components/AppShell.tsx` — sidebar + top bar for signed-in pages
- `src/components/overview/`, `src/components/project/` — page sections
- `src/theme.ts` — colour waves; change `ACTIVE_WAVE` to restyle everything
