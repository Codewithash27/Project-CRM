from sqlalchemy import create_engine, text
import os

e = create_engine(os.environ["DATABASE_URL"])
with e.connect() as c:
    users = c.execute(
        text(
            "select id, email, company_id, full_name from users "
            "where lower(email) like '%demo%' or lower(full_name) like '%demo%'"
        )
    ).all()
    print("users", users)
    for row in users:
        roles = c.execute(
            text(
                "select r.name from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=:id"
            ),
            {"id": row[0]},
        ).all()
        mem = c.execute(
            text(
                "select p.name, p.code from project_members pm "
                "join projects p on p.id=pm.project_id where pm.user_id=:id"
            ),
            {"id": row[0]},
        ).all()
        print(row[1], "company", row[2], "roles", roles, "projects", mem)
    print(
        "memberships",
        c.execute(
            text(
                "select u.email, r.name, p.code from project_members pm "
                "join users u on u.id=pm.user_id "
                "join projects p on p.id=pm.project_id "
                "left join user_roles ur on ur.user_id=u.id "
                "left join roles r on r.id=ur.role_id "
                "order by u.email limit 40"
            )
        ).all(),
    )
