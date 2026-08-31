from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

# NullPool a propósito: cada invocación serverless es efímera (proceso nuevo o
# reciclado), así que un pool propio de SQLAlchemy no aporta nada y compite con el
# pooler de Supabase (PgBouncer, puerto 6543, modo "Transaction") que ya maneja las
# conexiones reales contra Postgres. Dejar que SQLAlchemy abra/cierre una conexión
# por request es lo correcto en este contexto, no un descuido.
engine = create_engine(settings.database_url, poolclass=NullPool)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
