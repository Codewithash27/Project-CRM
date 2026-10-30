# Master prompt — paste this into Cursor after you unzip the project

Open this folder in **Cursor** → new Agent chat → copy **everything** inside the box below and send it.

Before that, install once on your PC (if missing):

- PostgreSQL 16 (remember the `postgres` user password, port `5432`)
- Python 3.12+
- Node.js 22+

Create the empty database once (SQL Shell / pgAdmin):

```sql
CREATE DATABASE aadi_crm;
```

---

## COPY FROM HERE ↓

```
You are setting up the Aadi CRM project on my Windows PC from a freshly unzipped folder.

Goal: make the app fully runnable locally with migrations applied, demo data seeded, backend on port 8000, frontend on port 5173, and show me the login emails/passwords when done.

Read these files first and follow them (do not invent a different stack):
- SETUP_FOR_COLLEGE.md
- README.md
- backend/.env.example
- frontend/.env.example
- backend/app/cli/seed_demo.py

Rules:
1. Ask me once for my PostgreSQL password for user `postgres` if backend/.env does not already have a working DATABASE_URL. Do not invent a password.
2. Work in this repo only. Prefer PowerShell commands.
3. Do not commit, push, or change git config.
4. Do not rewrite app features. Only setup: env files, venv, pip, npm, alembic, seed, and start servers.
5. If something already exists (venv, .env, node_modules), reuse it instead of deleting unless it is broken.
6. If a step fails, fix that step and continue. Tell me clearly what blocked you (Postgres not running, wrong password, missing CREATE DATABASE, etc.).

Do this in order:

### A) Check tools
- Confirm `python --version` (3.12+), `node --version` (22+), and that PostgreSQL is reachable on localhost:5432.
- If a tool is missing, stop and tell me exactly what to install. Do not continue past that.

### B) Backend env
- From `backend/`: create `.venv` if missing.
- Install: `.\.venv\Scripts\python.exe -m pip install -e ".[dev]"`
- Copy `.env.example` → `.env` if `.env` is missing.
- Set in `backend/.env`:
  - DATABASE_URL=postgresql+psycopg://postgres:MY_PASSWORD@localhost:5432/aadi_crm
    (use the password I give you; if password has `@`, encode it as `%40`)
  - JWT_SECRET to any long random string (≥32 chars) if still the placeholder
- Keep other .env values from the example unless broken.

### C) Database + migrations + seed
- Ensure database `aadi_crm` exists. If connection fails because the DB is missing, create it with psql/createdb or tell me to run: CREATE DATABASE aadi_crm;
- Run migrations: `.\.venv\Scripts\python.exe -m alembic upgrade head`
- Run seed: `.\.venv\Scripts\python.exe -m app.cli.seed_demo`
- Show me the seed output (counts + login table). Demo data comes from migration 0004; seed creates/resets Super Admin.

### D) Frontend env
- From `frontend/`: `npm install` if needed.
- Copy `.env.example` → `.env` if missing.
- Keep VITE_API_BASE_URL=http://localhost:8000

### E) Start the app
- Start backend in background:
  `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
  (working directory: backend)
- Start frontend in background:
  `npm run dev`
  (working directory: frontend)
- Verify API responds (e.g. open/docs or a simple request) and frontend is on http://localhost:5173

### F) Final reply to me (short)
Tell me only:
1. Backend URL + Frontend URL
2. Login accounts (copy from seed_demo output):
   - Super Admin: admin@example.com / CollegeDemo#1
   - Business Owner: arjun@aadi-demo.test / AadiDemo#2026
   - Salesperson: riya@aadi-demo.test / AadiDemo#2026
3. Reminder: open http://localhost:5173 (use localhost, not 127.0.0.1)
4. API docs: http://localhost:8000/api/docs
5. Any step that failed and the exact fix

Start now. Ask for my Postgres password if needed, then run the setup.
```

## COPY UNTIL HERE ↑

---

## After the AI finishes

1. Open **http://localhost:5173**
2. Login as `riya@aadi-demo.test` / `AadiDemo#2026`
3. You should see projects and leads

If login fails, ask Cursor:

```
Login is failing. Check that backend is running on 8000, frontend on 5173 with localhost (not 127.0.0.1), backend/.env DATABASE_URL is correct, alembic upgrade head and python -m app.cli.seed_demo succeeded. Fix and re-print login credentials.
```

## Optional: only migrate + seed again

```
From backend/, run alembic upgrade head and python -m app.cli.seed_demo. Show counts and login emails. Do not change application code.
```

## Optional: only start servers

```
Start backend with uvicorn on 127.0.0.1:8000 and frontend with npm run dev. Reuse existing .venv and node_modules. Then print the URLs and demo login emails from SETUP_FOR_COLLEGE.md.
```
