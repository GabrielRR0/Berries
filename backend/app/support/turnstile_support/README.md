# turnstile_support/

`verify_turnstile(token, remote_ip)` valida el token del widget de Cloudflare Turnstile.
Con `TURNSTILE_ENABLED=false` (por defecto) no hace nada. El módulo `auth` lo llama en
registro y login y traduce `TurnstileVerificationError` a su `HumanCheckFailedError` (400).
