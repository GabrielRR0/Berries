"""Correccion personalizada: compara cada palabra del transcript contra el vocabulario
REAL de este usuario (nombres de sus wallets, categorias que usa, titulos de sus metas
existentes) usando similitud de texto (difflib, stdlib, sin ML/API externa) - asi
"vaina" solo se corrige a "Binance" si el usuario de verdad tiene una wallet llamada
asi, nunca como regla global (ver static_terms.py)."""

import difflib
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.goals.goal_model import Goal
from app.models.transactions.category_model import Category
from app.models.wallets.wallet_model import Wallet

_WORD_RE = re.compile(r"[a-záéíóúñA-ZÁÉÍÓÚÑ]+")
_MIN_RATIO = 0.6
_MIN_WORD_LEN = 4  # evita corregir palabras cortas (alto riesgo de falso positivo)


def build_user_vocabulary(db: Session, user_id: uuid.UUID) -> list[str]:
    wallet_names = list(db.scalars(select(Wallet.name).where(Wallet.user_id == user_id)).all())
    category_names = list(
        db.scalars(select(Category.name).where((Category.user_id == user_id) | (Category.user_id.is_(None)))).all()
    )
    # Goal.title esta encriptado - se desencripta solo al leer las filas (transparente,
    # via el TypeDecorator de app/core/encryption.py), mismo patron que cualquier otra
    # agregacion en Python sobre columnas encriptadas del proyecto.
    goal_titles = [goal.title for goal in db.scalars(select(Goal).where(Goal.user_id == user_id)).all()]
    return [*wallet_names, *category_names, *goal_titles]


def correct_against_vocabulary(text: str, vocabulary: list[str]) -> tuple[str, list[tuple[str, str]]]:
    corrections: list[tuple[str, str]] = []
    if not vocabulary:
        return text, corrections

    lowered_vocabulary = [word.lower() for word in vocabulary]

    def replace(match: re.Match) -> str:
        word = match.group(0)
        if len(word) < _MIN_WORD_LEN:
            return word
        best = difflib.get_close_matches(word.lower(), lowered_vocabulary, n=1, cutoff=_MIN_RATIO)
        if not best:
            return word
        original_case = next(v for v in vocabulary if v.lower() == best[0])
        if original_case.lower() == word.lower():
            return word  # ya coincide exacto, no es una "correccion"
        corrections.append((word, original_case))
        return original_case

    return _WORD_RE.sub(replace, text), corrections
