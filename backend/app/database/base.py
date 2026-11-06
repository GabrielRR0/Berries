from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Clase base de todos los modelos. Cada módulo declara los suyos en `models/`."""
