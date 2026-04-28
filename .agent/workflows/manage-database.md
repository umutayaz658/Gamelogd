---
description: Safe Database Management and Migrations
---

# Database Management and Safe Migrations

Handling schema changes in PostgreSQL via Django safely without data loss.

## Local Development
- Any time `models.py` is changed, run:
  ```bash
  python manage.py makemigrations
  python manage.py migrate
  ```
- If migrations get out of sync or irrecoverably broken locally:
  1. Delete the underlying local SQLite or local Postgres DB.
  2. Remove all files inside `migrations/` folders EXCEPT `__init__.py`.
  3. Re-run `makemigrations` to create a fresh initial state (Warning: Only do this locally!).

## Production (Railway)
- Production migrations should be treated as irreversible. 
- Never delete migration files once they are pushed to GitHub.
- Railway will automatically run Python migrations on deployment via the Dockerfile CMD `python manage.py migrate --noinput`.
- If a column is dropped or changed critically in production, add `default` values to columns before making them non-nullable to prevent deploy crashes on existing rows.
