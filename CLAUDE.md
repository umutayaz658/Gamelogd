# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Gamelogd is a social platform for gamers, developers, and investors (game logging/reviews + a Letterboxd-style social feed + a Jira-style dev workspace + an investor/pitch board). It's a two-service monorepo:

- `frontend/` — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- `backend/` — Django 5 + Django REST Framework, PostgreSQL, token auth.

## Commands

### Frontend (`cd frontend`)
```
npm run dev      # start dev server (localhost:3000)
npm run build    # production build (also what CI runs as its main check)
npm run lint     # eslint
```
There is no frontend test runner configured — `npm run build` (type errors fail the build) and lint are the only automated checks.

### Backend (`cd backend`)
```
python manage.py runserver 0.0.0.0:8000
python manage.py migrate
python manage.py makemigrations
python manage.py test                 # run all tests
python manage.py test api.tests.SomeTestCase   # run a single test case
python manage.py check                # Django system check (part of CI)
```
Activate `backend/venv` (or your own venv) and `pip install -r requirements.txt` before running these. Backend tests are currently minimal (`api/tests.py` is a near-empty stub).

### Full stack via Docker
```
docker-compose up
```
Runs Postgres (`db`), Django dev server (`backend`, port 8000), and Next.js dev server (`frontend`, port 3000). Backend needs `backend/.env` (see `backend/.env.example`); frontend needs `frontend/.env.local`/`.env` (see `frontend/.env.example`, mainly `NEXT_PUBLIC_API_URL`).

### CI (`.github/workflows/ci.yml`)
On push/PR: frontend job runs `npm ci && npm run build`; backend job runs `manage.py check`, `manage.py makemigrations --check --dry-run` (fails if a model change is missing its migration), and `manage.py test`.

## Backend architecture

- Two Django apps share one database: **`core`** holds content/domain models (`Game`, `Review`, `Organisation`, `Project`, `Post`, `News`, `Pitch`, `InvestorCall`, `WorkspaceState`, etc.), while **`api`** holds the custom `User` model plus everything auth/social-graph-adjacent (`LibraryEntry`, `Follow`, `FollowRequest`, `Notification`, `Conversation`/`Message`, `Block`, `SupportTicket`) *and* virtually all views/serializers/URLs. `AUTH_USER_MODEL = 'api.User'`.
- Nearly all REST endpoints live in one file, `backend/api/views.py` (~2800 lines, one `ModelViewSet`/`ViewSet` per resource), wired up through a single `DefaultRouter` in `backend/api/urls.py` and mounted under `/api/`. When adding a resource, follow the existing pattern there rather than creating new app modules.
- Auth is DRF TokenAuthentication: clients send `Authorization: Token <token>`. There's also `GoogleLoginView` for Google OAuth and email-verification flow (`RegisterView` → `PendingRegistration` with a 6-digit code → `VerifyEmailView`).
- Object-level permissions are centralized in `backend/api/permissions.py` (`IsOwnerOrReadOnly`, `ProjectAccessPermission`) — these duck-type on `user`/`owner`/`recruiter` fields and organisation membership roles (`owner`/`admin`/`member` for orgs, `admin`/`editor`/`participant` for projects).
- **`Post` is a unified content model**: the same table backs normal feed posts, project devlogs (`project_parent`), replies to posts/reviews/news (`parent`/`review_parent`/`news_parent`), reposts (`repost_parent*`), and polls (`poll_options`). Feed/Explore surfaces filter by `category` (`POST_CATEGORIES` in `core/models.py`) and rank by `trending_score` (recomputed by the `update_trending` management command).
- **`WorkspaceState`** (`core/models.py`) is a generic per-user-or-per-organisation JSON key/value store, exposed via `WorkspaceStateViewSet` (lookup by `key`, not `id`). This is the persistence backbone for the whole "Devs" workspace on the frontend (Kanban board state, GDD Hub, localisation, asset registry, etc.) — the frontend just PUTs/GETs opaque JSON blobs. Keys prefixed `workspace__org_<id>_...` resolve to organisation scope (with a membership check); anything else resolves to the requesting user's own scope. When extending workspace features, prefer reusing this generic store over adding new dedicated models unless the data needs to be relationally queried.
- Media uploads go through Cloudinary in any environment with `CLOUDINARY_URL` set, otherwise fall back to local `FileSystemStorage` under `backend/media/`; static files are served via Whitenoise.
- Game metadata integrations (IGDB, Steam, HowLongToBeat) live in `backend/api/services/`; one-off data-fixing/import scripts live in `backend/api/management/commands/` and as loose scripts at the repo/backend root (`fetch_all_igdb*.py`, `fix_covers.py`, `sync_local.py`, etc.) — these are operational tools, not part of the running app.

## Frontend architecture

- Standard Next.js App Router layout under `frontend/src/app`. Key dynamic routes: `[username]` (public profile, with `games`/`recommended`/`review`/`status` subroutes), `games/[id]`, `developer/[name]`, `organisations/[slug]`, `projects/[id]`, `news/[id]`.
- Global providers are all mounted once in `frontend/src/app/layout.tsx` and wrap every page: `AuthProvider` → `NotificationProvider` → `LogModalProvider` → `ReplyModalProvider` → `FeedProvider`. Several singleton overlay components (`MessagesDrawer`, `ClientLogModalWrapper`, `ReplyModal`) are also rendered at the root so any page can trigger them through their respective context instead of local state. The app is dark-mode-only (`<html className="dark">`, no theme toggle).
- `frontend/src/lib/api.ts` is the single axios instance used app-wide; a request interceptor reads the `access_token` cookie (via `js-cookie`) and sets `Authorization: Token <token>` on every request. Use this instance rather than raw `fetch`/new axios instances.
- **The "Devs" section (`app/devs` + `components/devs`) is a large sub-application in its own right** — a Jira-style project workspace with a Kanban board (drag/drop, swimlanes, WIP limits, story points), a GDD Hub/Editor, team management, a localisation manager, and an asset registry (10k+ lines total, the biggest feature area in the codebase). State is centralized in `components/devs/WorkspaceContext.tsx` and persisted to the backend's generic `WorkspaceState`/`workspace-state` endpoint described above — most cross-component state for this section flows through that context rather than props. See `walkthrough.md` in the repo root for a feature-level changelog of recent Kanban/Devs work.
- Rich text (GDD docs, devlogs) uses Tiptap (`@tiptap/*`); animations use `framer-motion`.
