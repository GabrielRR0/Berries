# contracts/ — debts

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `dto/` — lo que ENTRA (body y query, validado por Pydantic)

- `create_debt_dto.py` — `CreateDebtDto`
- `create_debt_payment_dto.py` — `CreateDebtPaymentDto`
- `parse_debt_payment_voice_dto.py` — `ParseDebtPaymentVoiceDto`

## `resources/` — lo que SALE (una clase por respuesta)

- `debt_payment_resource.py` — `DebtPaymentResource`
- `debt_payment_voice_parse_resource.py` — `DebtPaymentVoiceParseResource`
- `debt_resource.py` — `DebtResource`
- `debt_summary_resource.py` — `DebtSummaryResource`
- `installment_resource.py` — `InstallmentResource`

## `enums.py`

Valores fijos que comparten la entrada y la salida: `Direction`.
