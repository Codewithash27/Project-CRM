# Aadi CRM — short setup

## Requirements

| Tool | Version |
|------|---------|
| PostgreSQL | 16+ (port `5432`) |
| Python | 3.12+ |
| Node.js | 22+ |

Create DB once:

```sql
CREATE DATABASE aadi_crm;
```

Use **one host** for browser + API (`127.0.0.1` recommended) so login cookies / CSRF work.

---

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Edit `backend/.env`: set `DATABASE_URL` password and a long `JWT_SECRET`.

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.cli.seed_demo
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: http://127.0.0.1:8000  
- Docs: http://127.0.0.1:8000/api/docs  

Packages come from `backend/pyproject.toml` (FastAPI, SQLAlchemy, Alembic, openpyxl, python-multipart, …).

---

## Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

- App: http://127.0.0.1:5173  
- `frontend/.env` should have `VITE_API_BASE_URL=http://127.0.0.1:8000`

Packages come from `frontend/package.json` (React, MUI, Vite, …).

---

## Demo logins

After `seed_demo`, use the emails printed in the terminal (e.g. owner / salesperson for Aadi). Password is the one set in the seed output / college guide.

---

## Import leads (quick)

1. **Lead Fields** → select project → add fields matching Excel headers.  
2. **Leads** → upload icon → pick project + `.xlsx` → Import.  
3. Rows need **Name** + **Phone**. Duplicate mobiles are skipped.

Longer college walkthrough: [SETUP_FOR_COLLEGE.md](SETUP_FOR_COLLEGE.md). Feature notes: [README.md](README.md).
