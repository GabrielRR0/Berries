# common/errors/

Cada módulo declara sus errores en `errors.py` heredando de `DomainError` con el código
HTTP que les toca:

```python
class WalletNotFoundError(DomainError):
    status_code = 404
```

El service lanza el error sin saber de HTTP (así se prueba llamándolo directo) y el
manejador global responde `{"detail": "<mensaje>"}` con ese código. Por eso los
controllers no tienen `try/except`.
