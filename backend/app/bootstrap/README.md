# bootstrap/

`create_app()` arma la app de FastAPI: docs solo en desarrollo, límite de pedidos,
manejador de errores de dominio, middlewares (en orden) y el árbol de rutas de `routes/`.
La usan `app/main.py` (uvicorn y Vercel cargan `app.main:app`) y las pruebas.

Orden de middlewares (deliberado): límite de pedidos → tamaño del cuerpo → origen →
headers de seguridad → CORS al final, para que CORS sea la capa más externa y sus
headers lleguen incluso a respuestas rechazadas por las capas anteriores.
