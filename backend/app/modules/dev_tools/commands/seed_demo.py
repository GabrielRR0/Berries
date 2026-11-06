"""`python manage.py seed:demo [--reset]`"""

from app.database import SessionLocal
from app.modules.dev_tools.services import DEMO_EMAIL, get_or_create_demo_user, reset_demo_user


def run(reset: bool) -> None:
    db = SessionLocal()
    try:
        if reset and reset_demo_user(db):
            print(f"Usuario demo previo ({DEMO_EMAIL}) y sus datos sembrados fueron borrados.")
        user = get_or_create_demo_user(db)
        print(f"Usuario demo listo: {user.email} (id={user.id})")
    finally:
        db.close()
