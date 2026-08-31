from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.transactions.drafts.draft_review_service import (
    confirm_draft,
    create_draft,
    discard_draft,
    list_drafts_for_user,
)
from app.services.transactions.errors import DraftNotFoundError
from app.services.wallets.wallet_service import create_wallet


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_create_draft_starts_pending(db):
    user = _user(db)

    draft = create_draft(db, user.id, "voice", "Gasté 15 USDT en transporte", Decimal("15"), "USDT", "Transporte", "Gasté 15 USDT en transporte")

    assert draft.status == "pending"
    assert draft.source == "voice"
    assert draft.parsed_amount == Decimal("15")


def test_confirm_draft_creates_real_transaction_and_flips_status(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USDT")
    draft = create_draft(db, user.id, "voice", "Gasté 15 USDT en transporte", Decimal("15"), "USDT", "Transporte", "raw")

    transaction, confirmed_draft = confirm_draft(
        db, draft.id, user.id, wallet.id, Decimal("15"), "Transporte", "Taxi al trabajo", "expense"
    )

    assert transaction.amount == Decimal("15.00")
    assert transaction.category == "Transporte"
    assert confirmed_draft.status == "confirmed"

    db.refresh(wallet)
    assert wallet.balance == Decimal("-15.00")


def test_confirm_draft_rejects_draft_not_owned_by_user(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = create_wallet(db, user_a.id, "Cash", "USD")
    draft = create_draft(db, user_a.id, "voice", "raw", Decimal("15"), "USD", "Transporte", "raw")

    with pytest.raises(DraftNotFoundError):
        confirm_draft(db, draft.id, user_b.id, wallet_a.id, Decimal("15"), "Transporte", None, "expense")


def test_discard_draft_flips_status_without_creating_transaction(db):
    user = _user(db)
    draft = create_draft(db, user.id, "ocr", "raw", Decimal("15"), "USD", None, "raw")

    discarded = discard_draft(db, draft.id, user.id)

    assert discarded.status == "discarded"
    assert list_drafts_for_user(db, user.id, status=None) == [discarded]
    assert list_drafts_for_user(db, user.id, status="pending") == []


def test_discard_draft_rejects_draft_not_owned_by_user(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    draft = create_draft(db, user_a.id, "ocr", "raw", None, None, None, None)

    with pytest.raises(DraftNotFoundError):
        discard_draft(db, draft.id, user_b.id)


def test_list_drafts_for_user_defaults_to_pending_only(db):
    user = _user(db)
    pending = create_draft(db, user.id, "voice", "raw1", None, None, None, None)
    other = create_draft(db, user.id, "voice", "raw2", None, None, None, None)
    discard_draft(db, other.id, user.id)

    drafts = list_drafts_for_user(db, user.id)

    assert drafts == [pending]
