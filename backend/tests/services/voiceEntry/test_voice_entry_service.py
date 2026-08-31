from decimal import Decimal

from app.services.auth.auth_service import register_user
from app.services.voiceEntry.voice_entry_service import submit_voice_entry
from app.services.wallets.wallet_service import create_wallet


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_submit_voice_entry_creates_pending_draft_from_transcript(db):
    user = _user(db)

    draft = submit_voice_entry(db, user.id, "USD", "Gasté 15 USDT en el gym")

    assert draft.source == "voice"
    assert draft.status == "pending"
    assert draft.raw_input == "Gasté 15 USDT en el gym"
    assert draft.parsed_amount == Decimal("15")
    assert draft.parsed_currency == "USDT"
    assert draft.parsed_category == "Gym"


def test_submit_voice_entry_falls_back_to_default_currency(db):
    user = _user(db)

    draft = submit_voice_entry(db, user.id, "EUR", "Compré comida en el mercado")

    assert draft.parsed_currency == "EUR"
    assert draft.parsed_category == "Mercado"


def test_submit_voice_entry_detects_full_balance_and_overrides_amount_and_currency(db):
    user = _user(db)
    binance = create_wallet(db, user.id, "Binance", "USDT")
    binance.balance = Decimal("123.45")
    db.commit()

    draft = submit_voice_entry(db, user.id, "USD", "He gastado todo lo que tenía en mi cuenta de Binance")

    assert draft.suggested_wallet_id == binance.id
    assert draft.parsed_amount == Decimal("123.45")
    assert draft.parsed_currency == "USDT"


def test_submit_voice_entry_without_full_balance_phrase_leaves_suggested_wallet_empty(db):
    user = _user(db)
    create_wallet(db, user.id, "Binance", "USDT")

    draft = submit_voice_entry(db, user.id, "USD", "Gasté 15 USDT en el gym")

    assert draft.suggested_wallet_id is None
