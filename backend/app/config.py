from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración global, leída de .env. Agrupada por dominio/feature.

    Los secrets (jwt_secret) no tienen default: si faltan, la app debe fallar al
    arrancar en vez de operar con un valor predecible.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # --- Base de datos ---
    database_url: str

    # --- Auth ---
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 días

    # --- Encriptación de datos financieros (ver app/core/encryption.py) ---
    # Pedido explícito del usuario: ni un admin mirando la tabla directo debe poder
    # ver montos/categorías/historial en texto plano. Sin default, igual criterio que
    # jwt_secret — si falta, la app debe fallar al arrancar en vez de guardar datos
    # financieros sin encriptar. Generar con:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    master_encryption_key: str

    # --- Beta cerrada ---
    # Default conservador para no sobrecargar el servidor mientras es gratis/beta;
    # se extiende solo cambiando la env var, sin tocar código.
    max_beta_users: int = 50

    # --- CORS ---
    frontend_url: str = "http://localhost:5173"

    # --- Cloudflare Turnstile ---
    turnstile_enabled: bool = False
    turnstile_secret_key: str = ""

    # --- Login con Google (ver app/shared/google_auth.py) ---
    # Vacío por default: /api/auth/google rechaza cualquier intento (GoogleAuthError)
    # hasta que se configure un Client ID real de Google Cloud Console.
    google_client_id: str = ""

    # --- Tasas de cambio --- (clientes reales aún sin conectar, ver services/currency/rates/)
    open_exchange_rates_app_id: str = ""
    currency_cache_ttl_hours: int = 24

    # --- Voz a texto: SIN setting acá — la transcripción ocurre en el navegador vía la
    # Web Speech API (ver frontend), el backend nunca recibe audio ni llama una API de
    # transcripción.

    # --- OCR de recibos --- (cliente real aún sin conectar)
    ocr_provider_api_key: str = ""

    # --- Push notifications (dominio construido de último) ---
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_admin_email: str = "admin@example.com"

    # --- Cron (Vercel) ---
    cron_secret: str = ""

    # --- Modo demo (solo para pruebas visuales locales) ---
    # Cuando está activo, /api/auth/login acepta cualquier email/password y siempre
    # entra a un usuario demo fijo con datos sembrados (ver services/devTools/). Nunca
    # se activa aunque la env var esté en true si environment=="production" — ver
    # `fake_data_mode_active` más abajo, que es lo que el resto del código debe usar
    # (nunca leer `fake_data_mode` solo, para no saltarse esta protección por error).
    fake_data_mode: bool = False

    @property
    def fake_data_mode_active(self) -> bool:
        return self.fake_data_mode and self.environment != "production"


settings = Settings()
