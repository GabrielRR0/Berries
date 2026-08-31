import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.services.debts.debt_service import (
    create_debt,
    delete_debt,
    get_debt_owned_by_user,
    get_debt_summary,
    list_debts_for_user,
)
from app.services.debts.errors import DebtNotFoundError, DebtValidationError
from app.services.debts.installment_service import mark_installment_paid

# El fixture `db` vive en tests/conftest.py y pytest lo inyecta automáticamente
# (no se importa como módulo, mismo motivo documentado en test_auth_service.py).


def test_create_debt_with_installments_splits_amount_and_sums_exactly(db):
    user_id = uuid.uuid4()

    debt = create_debt(
        db,
        user_id=user_id,
        counterparty_name="Cashea",
        direction="owed_by_user",
        total_amount=Decimal("100"),
        currency="USD",
        installment_count=3,
        first_due_date=date(2026, 1, 1),
    )

    assert len(debt.installments) == 3
    amounts = [inst.amount for inst in debt.installments]
    assert sum(amounts) == Decimal("100.00")
    # 100 / 3 = 33.33 repetido -> el remanente de redondeo cae en la última cuota
    assert amounts[0] == Decimal("33.33")
    assert amounts[1] == Decimal("33.33")
    assert amounts[2] == Decimal("33.34")


def test_create_debt_due_dates_spaced_by_frequency(db):
    user_id = uuid.uuid4()

    debt = create_debt(
        db,
        user_id=user_id,
        counterparty_name="Banco X",
        direction="owed_by_user",
        total_amount=Decimal("300"),
        currency="USD",
        installment_count=3,
        first_due_date=date(2026, 1, 1),
        frequency_days=15,
    )

    due_dates = [inst.due_date for inst in debt.installments]
    assert due_dates == [date(2026, 1, 1), date(2026, 1, 16), date(2026, 1, 31)]


def test_create_debt_without_installment_count_is_lump_sum(db):
    user_id = uuid.uuid4()

    debt = create_debt(
        db,
        user_id=user_id,
        counterparty_name="Juan Perez",
        direction="owed_to_user",
        total_amount=Decimal("50"),
        currency="USD",
    )

    assert debt.installments == []


def test_create_debt_rejects_non_positive_amount(db):
    user_id = uuid.uuid4()

    with pytest.raises(DebtValidationError):
        create_debt(
            db,
            user_id=user_id,
            counterparty_name="Cashea",
            direction="owed_by_user",
            total_amount=Decimal("0"),
            currency="USD",
        )


def test_get_debt_owned_by_user_raises_for_other_users_debt(db):
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    debt = create_debt(db, owner_id, "Cashea", "owed_by_user", Decimal("10"), "USD")

    with pytest.raises(DebtNotFoundError):
        get_debt_owned_by_user(db, debt.id, other_id)


def test_get_debt_owned_by_user_raises_for_unknown_id(db):
    with pytest.raises(DebtNotFoundError):
        get_debt_owned_by_user(db, uuid.uuid4(), uuid.uuid4())


def test_delete_debt_cascades_installments(db):
    from app.models.debts.installment_model import Installment

    user_id = uuid.uuid4()
    debt = create_debt(
        db, user_id, "Cashea", "owed_by_user", Decimal("90"), "USD", installment_count=3, first_due_date=date.today()
    )
    installment_ids = [inst.id for inst in debt.installments]

    delete_debt(db, debt.id, user_id)

    assert list_debts_for_user(db, user_id) == []
    for inst_id in installment_ids:
        assert db.get(Installment, inst_id) is None


def test_delete_debt_rejects_other_users_debt(db):
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    debt = create_debt(db, owner_id, "Cashea", "owed_by_user", Decimal("10"), "USD")

    with pytest.raises(DebtNotFoundError):
        delete_debt(db, debt.id, other_id)

    # sigue existiendo, el intento fallido no debe haber borrado nada
    assert get_debt_owned_by_user(db, debt.id, owner_id) is not None


def test_list_debts_for_user_filters_by_direction(db):
    user_id = uuid.uuid4()
    create_debt(db, user_id, "Cashea", "owed_by_user", Decimal("10"), "USD")
    create_debt(db, user_id, "Juan", "owed_to_user", Decimal("20"), "USD")

    owed_by_user = list_debts_for_user(db, user_id, direction="owed_by_user")
    owed_to_user = list_debts_for_user(db, user_id, direction="owed_to_user")

    assert len(owed_by_user) == 1
    assert owed_by_user[0].counterparty_name == "Cashea"
    assert len(owed_to_user) == 1
    assert owed_to_user[0].counterparty_name == "Juan"


def test_get_debt_summary_accounts_for_paid_installments(db):
    user_id = uuid.uuid4()
    # Deuda del usuario: 100 en 2 cuotas de 50, una pagada -> quedan 50 pendientes.
    owed_by_debt = create_debt(
        db, user_id, "Cashea", "owed_by_user", Decimal("100"), "USD", installment_count=2, first_due_date=date.today()
    )
    mark_installment_paid(db, owed_by_debt.installments[0].id, user_id)

    # Deuda hacia el usuario: 40 sin cuotas (lump sum) -> se cuenta completa.
    create_debt(db, user_id, "Ana", "owed_to_user", Decimal("40"), "USD")

    summary = get_debt_summary(db, user_id)

    assert summary["total_owed_by_user"] == Decimal("50.00")
    assert summary["total_owed_to_user"] == Decimal("40.00")


def test_get_debt_summary_is_zero_with_no_debts(db):
    summary = get_debt_summary(db, uuid.uuid4())

    assert summary["total_owed_by_user"] == Decimal("0")
    assert summary["total_owed_to_user"] == Decimal("0")
