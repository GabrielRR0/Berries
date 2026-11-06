from pydantic import BaseModel


class GoogleCheckResource(BaseModel):
    # Usado por LoginForm.vue para decidir, sin crear nada todavia, si "Continuar con
    # Google" debe loguear directo (cuenta existente) o mandar al wizard completo de
    # registro (cuenta nueva, mismo criterio que RegisterWizard: billeteras/moneda
    # antes de crear la cuenta, no solo un login silencioso).
    exists: bool
