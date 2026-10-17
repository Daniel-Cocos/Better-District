# Backend

First populate the sqlite database:

```sh
make seed
```

The seed creates five fictional Southampton community events around the Common,
Portswood, Riverside Park, Old Town, and Mayflower Park. Rerunning it refreshes
the demo event details, coordinates, and comment text while preserving votes
and existing accounts.

Events include `closes_at`: the time discussion closes / action is due. New
`POST /events` requests require an ISO 8601 timestamp with timezone, for example
`2026-11-01T17:00:00Z`; the API stores UTC and includes it in event responses.
Startup migrates existing SQLite databases without deleting events or comments.
Legacy events without a deadline return `null`; the demo seed sets fictional
November 2026 deadlines. This field records the deadline; it does not schedule
real actions or automatically disable comments.

From `backend/`, enter the environment and start the server:

```sh
nix develop path:.
make dev
```

Server: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Comments support likes/dislikes, editing, deletion, and a profile history. Only the author can edit or delete a comment. Authors can see their vote counts but cannot like or dislike their own comments. Signed-in ownership follows the account; anonymous ownership uses a persistent device cookie. Anonymous comments created before ownership was added cannot be claimed.

Set or remove votes with `PUT /events/{id}/vote` or `PUT /events/{id}/comments/{comment_id}/vote`, using `{ "vote": 1 }`, `-1`, or `0`. Responses include `my_vote`; comments include `is_mine`. Use `PATCH` (body text) or `DELETE` on `/events/{id}/comments/{comment_id}`. `GET /users/me/comments` returns the current account or guest’s comments, newest first, including `event_title`. Existing databases gain ownership and voting storage on startup.

## Admin website

The council admin website (React, in `web/`) uses the
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
