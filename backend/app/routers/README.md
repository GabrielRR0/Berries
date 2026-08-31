# app/routers/

Acá viven los endpoints de la API — las URLs que el frontend llama. Una carpeta por dominio, y cada endpoint sigue siempre los mismos tres pasos.

## Lo que hace un router (y nada más)

1. Recibe los datos ya validados (por `app/schemas/`) y sabe quién es el usuario logueado.
2. Llama a una función de `app/services/<dominio>/` para que haga el trabajo real.
3. Devuelve el resultado, o convierte un error en la respuesta HTTP correcta.

Un router nunca arma consultas a la base de datos directamente, nunca decide reglas de negocio (como si alcanza el saldo para una transferencia), y no necesita saber cómo se ve una fila de la base — solo conoce el schema de entrada y salida.

## Cómo se traducen los errores

Cada dominio de `app/services/` define sus propios errores (por ejemplo, "billetera no encontrada" o "saldo insuficiente"). El router los atrapa uno por uno y los convierte en el código de respuesta que corresponde:

```python
try:
    from_wallet, to_wallet = execute_transfer(db, current_user.id, ...)
except WalletNotFoundError as exc:
    raise HTTPException(status_code=404, detail=str(exc)) from exc
except InsufficientBalanceError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
```

Si un servicio lanza un error que el router no esperaba, la petición termina en un error 500 — es la señal de que falta agregar ese caso, no algo para ocultar con un manejo genérico de errores.

## Por qué está separado de la lógica real

Así se puede probar la lógica de negocio (en `app/services/`) sin tener que simular una petición HTTP completa. Los tests de los routers son pocos y simples a propósito: solo confirman que cada error se traduce al código correcto, no repiten las pruebas de la lógica de negocio.
