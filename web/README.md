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

3. Open http://localhost:5173 and sign in with username `admin` and password `admin`.

## Pages

Map and Feed are 1:1 copies of the app's tabs of the same names, plus moderation tools.
Everything updates live as residents use the app.

- `/login` — admin sign-in (username `admin`, password `admin` for now)
- `/` — overview: counts of events, comments, votes and resident accounts; latest comments
  (delete any); events closing soon
- `/map` — the app's map and event panel; add an event, or pick a pin to edit or delete it and its
  comments. `?event=<id>` opens one.
- `/feed` — the app's feed cards, with edit and delete

## Layout

- `src/api/` — axios client (`client.ts`: token + 401 handling), `events.ts` (events, comments,
  moderation, live change stream), `overview.ts`
- `src/auth/AuthContext.tsx` — signed-in admin state, session restore on reload
- `src/components/AppShell.tsx` — sidebar + top bar for signed-in pages
- `src/components/events/` — app-matching panel, card and comment, the add/edit form, and
  `useEventActions` (shared add/edit/delete dialogs)
- `src/hooks/useLiveEvents.ts` — the app's events, kept current by the change stream
- `src/utils/eventDeadline.ts` — the app's deadline wording
- `src/theme.ts` — colour waves; change `ACTIVE_WAVE` to restyle everything
