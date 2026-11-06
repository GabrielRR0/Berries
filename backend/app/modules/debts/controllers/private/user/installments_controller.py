import uuid

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.debts import services
from app.modules.debts.contracts.resources import InstallmentResource

router = auth_group()


@router.post("/{debt_id}/installments/{installment_id}/pay", response_model=InstallmentResource)
async def pay(debt_id: uuid.UUID, installment_id: uuid.UUID, db: DbSession, user: CurrentUser) -> InstallmentResource:
    return InstallmentResource.model_validate(services.pay_installment_of_debt(db, debt_id, installment_id, user.id))


@router.post("/{debt_id}/installments/{installment_id}/unpay", response_model=InstallmentResource)
async def unpay(debt_id: uuid.UUID, installment_id: uuid.UUID, db: DbSession, user: CurrentUser) -> InstallmentResource:
    return InstallmentResource.model_validate(services.unpay_installment_of_debt(db, debt_id, installment_id, user.id))
