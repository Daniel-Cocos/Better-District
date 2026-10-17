# Better District: Project Summary

Better District is a map-based platform for Southampton City Council. The council publishes proposals and projects at places on a city map, and residents respond through comments, polls and surveys. Council staff manage everything from an admin website. Residents take part through a mobile app.

> Status: early development. Everything below runs locally with sample data.

## What it does

- **Council staff** sign in to an admin website. They create projects, place them on the map and choose how residents can respond.
- **Residents** see published projects on the map in the mobile app. They can comment, like or dislike.
- **Every project states clearly** what is already decided and what residents' feedback can still change.

## The three parts

| Part | Location | Built with | Purpose |
| --- | --- | --- | --- |
| Backend API | `Soton-Ship/backend` | Python, FastAPI, SQLite | Stores events, comments, users, admins and projects |
| Mobile app | `Soton-Ship/mobile` | React Native (Expo) | Resident-facing app (early stage) |
| Admin website | `Soton-Ship/web` | React, MUI, axios, Leaflet | Council staff portal |

The admin website calls the backend through axios. In development, Vite forwards `/api/*` to the backend on port 8000.

## Admin website

### Sign in (`/login`)
Email and password for council staff. A successful sign-in returns a bearer token that lasts 8 hours.

### Overview (`/`)
- Counts of open proposals, live trials and built projects
- Resident responses (comments plus likes and dislikes)
- A simplified map preview of where every project sits
- The latest resident comments
- Unpublished drafts, with links to resume them
- A list of all published projects, filterable by stage

### New project wizard (`/projects/new`)
Five steps, based on the team's sketch:

1. **Basics:** title, stage (Proposal, Live trial or Built), feedback open and close dates, responsible team and contact.
2. **Location:** an OpenStreetMap map. Click to drop a pin, drag to move it, and set the radius the project covers. Includes place search and an optional ward.
3. **Documents:** file uploads (PDF, Word, text or images, up to 20 MB each), a summary, the council's commitments and custom fields.
4. **Permanent and changeable:** two lists, "What is permanent" and "Your views can change this".
5. **Questions and comments:** polls, multiple choice, written answers and 1–5 ratings. Settings for default questions, custom comments, replies and optional demographic questions.

You can save a draft at any step. **Publish** checks every step first and points to anything missing. Publishing creates a normal event, so the project appears in the mobile app straight away.

## Backend API

| Endpoints | Used by | Purpose |
| --- | --- | --- |
| `/events`, `/events/{id}/comments`, `/users` | Mobile app | Public projects, comments, resident accounts (HTTP Basic auth) |
| `/auth/login`, `/auth/me`, `/auth/logout` | Admin website | Staff sign-in with bearer tokens |
| `/admin/overview` | Admin website | Data for the overview page |
| `/admin/drafts`, `/admin/projects`, `/admin/uploads` | Admin website | Drafts, publishing, documents |

**Data model.** A published project is a row in `events` plus a row in `projects`. Child tables hold documents, custom fields, permanent/changeable items and questions. Drafts are stored separately in `project_drafts` and never appear in public `/events`. Admins are users who also have a row in the `admins` table.

Interactive API docs: http://localhost:8000/docs

## Running it locally

```sh
# Backend (from Soton-Ship/backend)
make seed && make dev            # with Nix
# or without Nix, see backend/README.md

# Admin website (from Soton-Ship/web)
npm install
npm run dev                      # http://localhost:5173
```

**Demo accounts (sample data only):**

| Who | Email | Password |
| --- | --- | --- |
| Council admin (website) | `admin@southampton.gov.uk` | `council-admin-2026` |
| Quick local admin (website) | `admin` | `admin` |
| Residents (app) | `alex@example.com`, `sam@example.com` | `council-demo-2026` |

## Not built yet

- Full-page interactive city map, and lists of proposals, projects and ideas
- Editing a project after it is published
- Resident-facing questions and polls in the app (the backend stores them but nothing displays them yet)
- Comment moderation, reply threads and comment timestamps
- AI summaries of large volumes of resident comments
- Restricting who can take part (signed-in residents only, etc.)
- Moving the admin website into this repo (for example as `web/`)
