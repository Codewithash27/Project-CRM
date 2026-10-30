import re
from pathlib import Path

files = list(Path("tests").glob("test_*.py"))
for path in files:
    text = path.read_text(encoding="utf-8")
    original = text
    text = text.replace('"SALES_REP"', '"SALESPERSON"')
    text = text.replace("'SALES_REP'", "'SALESPERSON'")
    text = text.replace('"SALES_MANAGER"', '"SALESPERSON"')
    text = text.replace("'SALES_MANAGER'", "'SALESPERSON'")
    text = text.replace('"VIEWER"', '"SALESPERSON"')
    text = text.replace("'VIEWER'", "'SALESPERSON'")
    text = re.sub(r'(?<![A-Z_])"ADMIN"', '"BUSINESS_OWNER"', text)
    text = re.sub(r"(?<![A-Z_])'ADMIN'", "'BUSINESS_OWNER'", text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        print("updated", path)
