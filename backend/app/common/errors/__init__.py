"""Errores de dominio con su código HTTP y el manejador que los convierte en respuesta."""

from app.common.errors.domain_error import DomainError, register_error_handlers

__all__ = ["DomainError", "register_error_handlers"]
