"""Valores fijos que comparten lo que entra (dto) y lo que sale (resources)."""

from typing import Literal

# "owed_by_user": el usuario debe esto. "owed_to_user": a el usuario se lo deben.
Direction = Literal["owed_by_user", "owed_to_user"]
