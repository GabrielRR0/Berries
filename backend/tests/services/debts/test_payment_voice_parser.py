import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services.debts.debt_service import create_debt
from app.services.debts.errors import DebtNotFoundError
from app.services.debts.payment_voice_parser import (
    parse_debt_payment_transcript,
    parse_debt_payment_voice,
    parse_relative_date_phrase,
)

TODAY = date(2026, 8, 31)


def test_parse_relative_date_phrase_recognizes_hoy_as_today():
    assert parse_relative_date_phrase("hoy me pagaron 50 dólares", today=TODAY) == TODAY


def test_parse_relative_date_phrase_recognizes_ayer():
    assert parse_relative_date_phrase("ayer me pagó 50", today=TODAY) == TODAY - timedelta(days=1)


def test_parse_relative_date_phrase_recognizes_anteayer():
    assert parse_relative_date_phrase("anteayer me dieron 50", today=TODAY) == TODAY - timedelta(days=2)


def test_parse_relative_date_phrase_recognizes_hace_n_dias():
    assert parse_relative_date_phrase("hace 3 días me pagó", today=TODAY) == TODAY - timedelta(days=3)


def test_parse_relative_date_phrase_recognizes_semana_pasada():
    assert parse_relative_date_phrase("la semana pasada me pagó", today=TODAY) == TODAY - timedelta(days=7)


def test_parse_relative_date_phrase_defaults_to_today_when_unrecognized():
    assert parse_relative_date_phrase("este mes me pagó", today=TODAY) == TODAY
    assert parse_relative_date_phrase("me pagaron 50 dólares", today=TODAY) == TODAY


def test_parse_debt_payment_voice_extracts_amount_and_currency():
    parsed = parse_debt_payment_voice("hoy me pagaron 50 usdt", default_currency="USD")

    assert parsed.amount == 50.0
    assert parsed.currency == "USDT"


def test_parse_debt_payment_voice_falls_back_to_default_currency():
    parsed = parse_debt_payment_voice("ayer me pagaron 50", default_currency="VEF")

    assert parsed.currency == "VEF"


def test_parse_debt_payment_transcript_rejects_a_debt_owned_by_another_user(db):
    owner_id = uuid.uuid4()
    debt = create_debt(
        db,
        user_id=owner_id,
        counterparty_name="Steven",
        direction="owed_to_user",
        total_amount=Decimal("500"),
        currency="USD",
    )

    with pytest.raises(DebtNotFoundError):
        parse_debt_payment_transcript(db, debt.id, uuid.uuid4(), "hoy me pagaron 50")


def test_parse_debt_payment_transcript_uses_the_debts_currency_as_default(db):
    user_id = uuid.uuid4()
    debt = create_debt(
        db,
        user_id=user_id,
        counterparty_name="Steven",
        direction="owed_to_user",
        total_amount=Decimal("500"),
        currency="VEF",
    )

    parsed = parse_debt_payment_transcript(db, debt.id, user_id, "hoy me pagaron 50")

    assert parsed.currency == "VEF"
    assert parsed.amount == 50.0
