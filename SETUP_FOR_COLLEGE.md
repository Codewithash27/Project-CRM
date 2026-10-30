# Aadi CRM — simple setup (for college)

Follow this once on Windows. After it works you will see sample companies, users, projects, and leads in the app.

**Using Cursor?** Open the unzipped folder, then open [`prompt.md`](prompt.md) and paste the **master prompt** into Agent chat — it will install, migrate, seed, and start the app for you.

You need about 15–20 minutes the first time (or a few minutes with Cursor + the prompt).

---

## What you install

| Tool | Why | Download |
|------|-----|----------|
| **PostgreSQL 16** | Database | https://www.postgresql.org/download/windows/ |
| **Python 3.12+** | Backend API | https://www.python.org/downloads/ |
| **Node.js 22+** | Frontend | https://nodejs.org/ |

During PostgreSQL install:

1. Remember the password you set for user `postgres`.
2. Keep port **5432**.
3. Install **pgAdmin** if the installer offers it (optional, useful to browse tables).

---

## 1. Create the database

Open **SQL Shell (psql)** or pgAdmin Query Tool, and run:

```sql
CREATE DATABASE aadi_crm;
```

That is enough. Tables are created by the app migrations in the next step.

---

## 2. Backend (API)

Open PowerShell in the project folder, then:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Edit `backend/.env` and set your Postgres password (replace `CHANGE_ME`):

```env
DATABASE_URL=postgresql+psycopg://postgres:CHANGE_ME@localhost:5432/aadi_crm
JWT_SECRET=college-demo-secret-at-least-32-characters-long
```

If your password contains `@`, write it as `%40` in the URL.

Create tables + load sample data, then create the admin user:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.cli.seed_demo
```

You should see counts like companies, users, projects, leads, and login emails.

Start the API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Leave this window open. API docs: http://localhost:8000/api/docs

---

## 3. Frontend (website)

Open a **second** PowerShell window:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open: **http://localhost:5173**  
(Use `localhost`, not `127.0.0.1`, so login cookies work.)

---

## 4. Login and see data

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@example.com` | `CollegeDemo#1` |
| Business Owner (Aadi) | `arjun@aadi-demo.test` | `AadiDemo#2026` |
| Salesperson | `riya@aadi-demo.test` | `AadiDemo#2026` |
| Salesperson | `kunal@aadi-demo.test` | `AadiDemo#2026` |

Sign in as **Riya** or **Arjun** — you should see projects and leads already filled in.

---

## 5. Database design (simple)

One company owns many projects and users. Leads belong to a company and usually a project. Roles control what each user can do.

```mermaid
erDiagram
    companies ||--o{ users : has
    companies ||--o{ projects : has
    companies ||--o{ leads : has
    projects ||--o{ project_members : assigns
    users ||--o{ project_members : joins
    projects ||--o{ leads : contains
    users ||--o{ leads : owns
    roles ||--o{ user_roles : granted
    users ||--o{ user_roles : has
    roles ||--o{ role_permissions : grants
    permissions ||--o{ role_permissions : used_by

    companies {
        uuid id PK
        string name
        string status
        string plan_label
    }
    users {
        uuid id PK
        string email
        string full_name
        uuid company_id FK
        bool is_active
    }
    projects {
        uuid id PK
        uuid company_id FK
        string name
        string code
        string template
    }
    leads {
        uuid id PK
        uuid company_id FK
        uuid project_id FK
        string lead_number
        string full_name
        string mobile
        string status
        string priority
        uuid owner_id FK
    }
    roles {
        uuid id PK
        string name
    }
    permissions {
        uuid id PK
        string key
    }
```

### Main tables (what they store)

| Table | Meaning |
|-------|---------|
| `companies` | A business / tenant (e.g. Aadi CRM Development) |
| `users` | People who log in; linked to one company |
| `roles` | `SUPER_ADMIN`, `BUSINESS_OWNER`, `SALESPERSON`, `MARKETING` |
| `user_roles` | Which role each user has |
| `permissions` / `role_permissions` | Fine-grained actions (read leads, create users, …) |
| `projects` | Work areas inside a company (Paneerwala, Hiring, …) |
| `project_members` | Which salespeople are assigned to which project |
| `leads` | Customer / candidate enquiries |
| `teams` | Optional groups inside a company |
| `refresh_tokens` / `password_reset_tokens` | Auth session + reset security |
| `audit_logs` | Who changed what |

Sample demo data is inserted automatically by migration `0004_projects_and_demo_leads` when you run `alembic upgrade head`.

---

## 6. Check data in Postgres (optional)

In psql or pgAdmin:

```sql
\c aadi_crm

SELECT name, plan_label FROM companies;
SELECT email, full_name FROM users ORDER BY email;
SELECT name, code FROM projects;
SELECT lead_number, full_name, status, priority FROM leads LIMIT 10;
```

---

## Common problems

| Problem | Fix |
|---------|-----|
| `password authentication failed` | Wrong password in `DATABASE_URL` inside `backend/.env` |
| `database "aadi_crm" does not exist` | Run `CREATE DATABASE aadi_crm;` again |
| `connection refused` on 5432 | Start PostgreSQL Windows service |
| Frontend loads but login fails | Backend must be running on port 8000; open `localhost:5173` not `127.0.0.1` |
| No leads after login | Run `alembic upgrade head` then `python -m app.cli.seed_demo` again |
| `npm` / `python` not found | Close and reopen PowerShell after installing Node/Python; tick “Add to PATH” on install |

---

## Quick command cheat sheet

```powershell
# Terminal 1 — API
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — UI
cd frontend
npm run dev
```

Re-print login info anytime:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.cli.seed_demo
```
