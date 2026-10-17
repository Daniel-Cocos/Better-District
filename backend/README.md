# Backend

First populate the sqlite database:

```sh
make seed
```

From `backend/`, enter the environment and start the server:

```sh
nix develop path:.
make dev
```

Server: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Admin website

The council admin website (React, separate repo folder `soton-council-map`) uses the
`/auth/*` and `/admin/*` endpoints. After `make seed`, sign in as
`admin@southampton.gov.uk` / `council-admin-2026`.

- Admins are rows in the `admins` table on top of `users`; they get bearer tokens from `POST /auth/login`.
- The project wizard saves drafts to `project_drafts`; publishing creates a normal `events` row
  (so the app sees it) plus `projects`, `project_documents`, `project_fields`, `project_terms`
  and `project_questions`. Uploaded files are stored in `data/uploads/`.

Without Nix (e.g. on Windows):

```sh
python -m venv .venv
.venv/Scripts/python -m pip install fastapi uvicorn httpx pytest hypothesis requests python-multipart
.venv/Scripts/python -m app.seed
.venv/Scripts/python -m uvicorn app.main:app --reload
```
