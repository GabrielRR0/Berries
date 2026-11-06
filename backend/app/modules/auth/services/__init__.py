"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.auth.services.account_deletion_service import delete_own_account
from app.modules.auth.services.auth_service import (
    authenticate_user,
    google_account_exists,
    login_or_register_with_google,
    register_user,
)
from app.modules.auth.services.human_check import verify_human
from app.modules.auth.services.session_service import issue_session

__all__ = [
    "authenticate_user",
    "delete_own_account",
    "google_account_exists",
    "issue_session",
    "login_or_register_with_google",
    "register_user",
    "verify_human",
]
