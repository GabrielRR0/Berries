import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services.debts.debt_service import create_debt
from app.services.debts.errors import DebtNotFoundError, InstallmentAlreadyPaidError
from app.services.debts.installment_service import (
    get_due_installments,
    list_installments_for_debt,
    mark_installment_paid,
    mark_installment_unpaid,
)

# El fixture `db` vive en tests/conftest.py y pytest lo inyecta automáticamente.


def test_mark_installment_paid_sets_status_and_paid_at(db):
    user_id = uuid.uuid4()
    debt = create_debt(
        db, user_id, "Cashea", "owed_by_user", Decimal("60"), "USD", installment_count=3, first_due_date=date.today()
    )
    installment = debt.installments[0]
    assert installment.status == "pending"
    assert installment.paid_at is None

    paid = mark_installment_paid(db, installment.id, user_id)

    assert paid.status == "paid"
    assert paid.paid_at is not None


def test_mark_installment_paid_rejects_double_payment(db):
    user_id = uuid.uuid4()
    debt = create_debt(
        db, user_id, "Cashea", "owed_by_user", Decimal("60"), "USD", installment_count=2, first_due_date=date.today()
    )
    installment = debt.installments[0]
    mark_installment_paid(db, installment.id, user_id)

    with pytest.raises(InstallmentAlreadyPaidError):
        mark_installment_paid(db, installment.id, user_id)


def test_mark_installment_unpaid_reverses_payment(db):
    user_id = uuid.uuid4()
    debt = create_debt(
        db, user_id, "Cashea", "owed_by_user", Decimal("60"), "USD", installment_count=2, first_due_date=date.today()
    )
    installment = debt.installments[0]
    mark_installment_paid(db, installment.id, user_id)

    unpaid = mark_installment_unpaid(db, installment.id, user_id)

    assert unpaid.status == "pending"
    assert unpaid.paid_at is None


def test_mark_installment_paid_rejects_other_users_installment(db):
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    debt = create_debt(
        db, owner_id, "Cashea", "owed_by_user", Decimal("60"), "USD", installment_count=1, first_due_date=date.today()
    )
    installment = debt.installments[0]

    with pytest.raises(DebtNotFoundError):
        mark_installment_paid(db, installment.id, other_id)

    # el intento fallido no debe haber mutado nada
    assert installment.status == "pending"


def test_list_installments_for_debt_rejects_other_users_debt(db):
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    debt = create_debt(
        db, owner_id, "Cashea", "owed_by_user", Decimal("60"), "USD", installment_count=2, first_due_date=date.today()
    )

    with pytest.raises(DebtNotFoundError):
        list_installments_for_debt(db, debt.id, other_id)

    assert len(list_installments_for_debt(db, debt.id, owner_id)) == 2


def test_get_due_installments_includes_overdue_and_due_today_across_users(db):
    today = date(2026, 1, 15)
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    debt_a = create_debt(
        db,
        user_a,
        "Cashea",
        "owed_by_user",
        Decimal("90"),
        "USD",
        installment_count=3,
        first_due_date=today - timedelta(days=30),
        frequency_days=30,
    )
    debt_b = create_debt(
        db, user_b, "Banco Y", "owed_by_user", Decimal("50"), "USD", installment_count=1, first_due_date=today
    )
    future_debt = create_debt(
        db,
        user_a,
        "Futuro",
        "owed_by_user",
        Decimal("20"),
        "USD",
        installment_count=1,
        first_due_date=today + timedelta(days=5),
    )

    due = get_due_installments(db, today)
    due_ids = {inst.id for inst in due}

    # debt_a tiene cuotas en today-30 (vencida) y today (vence hoy): ambas deben estar.
    overdue_and_today = [inst for inst in debt_a.installments if inst.due_date <= today]
    assert len(overdue_and_today) == 2
    assert all(inst.id in due_ids for inst in overdue_and_today)

    # la cuota de debt_a en today+30 (futura) no debe estar.
    future_installment_of_a = next(inst for inst in debt_a.installments if inst.due_date > today)
    assert future_installment_of_a.id not in due_ids

    # cross-user: debt_b pertenece a otro usuario y debe aparecer igual (no scoped a un solo usuario).
    assert debt_b.installments[0].id in due_ids
    assert future_debt.installments[0].id not in due_ids

    owner_ids = {inst.debt.user_id for inst in due}
    assert user_a in owner_ids
    assert user_b in owner_ids


def test_get_due_installments_excludes_paid(db):
    today = date(2026, 2, 1)
    user_id = uuid.uuid4()
    debt = create_debt(
        db, user_id, "Cashea", "owed_by_user", Decimal("50"), "USD", installment_count=1, first_due_date=today
    )
    installment = debt.installments[0]
    mark_installment_paid(db, installment.id, user_id)

    due = get_due_installments(db, today)

    assert installment.id not in {inst.id for inst in due}


def test_get_due_installments_excludes_future(db):
    today = date(2026, 3, 1)
    user_id = uuid.uuid4()
    debt = create_debt(
        db,
        user_id,
        "Cashea",
        "owed_by_user",
        Decimal("50"),
        "USD",
        installment_count=1,
        first_due_date=today + timedelta(days=1),
    )

    due = get_due_installments(db, today)

    assert debt.installments[0].id not in {inst.id for inst in due}
