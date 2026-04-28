---
description: Deploying Gamelogd to Production (Vercel & Railway)
---

# Deploying Gamelogd to Production

This workflow ensures all security, CORS, and environment variables are properly set before deploying the Gamelogd application to Vercel (Frontend) and Railway (Backend).

## 1. Backend Pre-flight Checks (Django / Railway)
- **Check Environment Variables:** Ensure all required secrets are configured in Railway:
  - `DATABASE_URL` (PostgreSQL connection string)
  - `CLOUDINARY_URL` (For secure media storage)
  - `STEAM_API_KEY` (Required for Steam Sync, 500 error will occur if missing)
  - `CORS_ALLOW_ALL_ORIGINS=True` (or explicit `CORS_ALLOWED_ORIGINS`)
  - `DJANGO_ALLOWED_HOSTS=*` (or explicit Railway domain)
  - `DEBUG=0` (Crucial for production security)
- **Check Dockerfile:** Ensure the `Dockerfile` runs migrations before starting Gunicorn: `CMD python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`

## 2. Frontend Pre-flight Checks (Next.js / Vercel)
- **Check Environment Variables:** Ensure `NEXT_PUBLIC_API_URL` is set to the Railway domain (ending in `/api`).
- **Mixed Content Warnings:** Verify `src/lib/utils.ts` continues to force Cloudinary HTTP URLs to `https://` to prevent "Mixed Content" blocked requests on Vercel.

## 3. Redeployment
- Always trigger a redeploy on Vercel if environment variables are changed, as Next.js bakes `NEXT_PUBLIC_` variables into static assets at build time.
