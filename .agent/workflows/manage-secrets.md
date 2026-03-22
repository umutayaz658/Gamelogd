---
description: Managing Secrets and Environment Variables securely
---

# Managing Secrets & Environment Variables

Strict procedure for adding new API keys or configuring environment-specific settings in Gamelogd.

## 1. Local Configuration (`.env`)
- When a new variable is needed (e.g., `TWITCH_CLIENT_ID`), add it to your local `backend/.env` or `frontend/.env.local`.
- **CRITICAL:** Immediately documented the new variable in `backend/.env.example` or equivalent frontend example file with a dummy value, so future developers or AI agents know it is required.

## 2. Frontend Variables (Next.js)
- Variables that must be accessed by the browser (React components) MUST be prefixed with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_API_URL`).
- Variables without this prefix will remain safely hidden on the Node.js server.
- **Vercel Rule:** If you add a `NEXT_PUBLIC_` variable to Vercel via the Production dashboard, you MUST trigger a **Redeploy**. Next.js bakes public environment variables into the static HTML/JS files at build time. Changing the variable without rebuilding has 0 effect.

## 3. Backend Variables (Django)
- Access variables using `os.environ.get('VARIABLE_NAME', 'fallback_value')`.
- Variables dictating security (`DEBUG`, `SECRET_KEY`, `CORS_ALLOW_ALL_ORIGINS`) must never have dangerous defaults in `settings.py`.
- **Railway Rule:** Adding variables to the Railway dashboard forces an automatic redeployment of the container. 

## 4. Troubleshooting Missing Secrets
- Always wrap 3rd-party API calls (Steam, IGDB) in `try...except` and return a clean HTTP 500 error if the configuration `os.environ.get()` returns `None`, rather than letting the application crash silently.
