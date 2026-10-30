from sqlalchemy import create_engine, text

url = ""
with open(".env", encoding="utf-8") as env_file:
    for line in env_file:
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip()
            break

engine = create_engine(url)
with engine.connect() as connection:
    rows = connection.execute(
        text(
            """
            SELECT r.name, p.key
            FROM roles r
            JOIN role_permissions rp ON rp.role_id = r.id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE r.name = 'SUPER_ADMIN' AND p.key LIKE 'roles.%'
            ORDER BY p.key
            """
        )
    ).fetchall()
    print("SUPER_ADMIN roles.*:", rows)
    keys = connection.execute(
        text("SELECT key FROM permissions WHERE key LIKE 'roles.%' ORDER BY key")
    ).fetchall()
    print("catalogue roles.*:", keys)
