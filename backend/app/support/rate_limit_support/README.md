# rate_limit_support/

Re-exporta de slowapi lo que usa la app: `Limiter`, `RateLimitExceeded` y
`RateLimitMiddleware`. La política (cuántos pedidos y por qué clave) vive en
`common/security/rate_limits.py`.
