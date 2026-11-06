# services/ — voice_entry

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`voice_entry_service.py`** — Convertir un dictado en borrador de movimiento.

## `correction/`

- **`correction_service.py`** — Capa de correccion de transcripciones, COMPARTIDA entre el registro por voz de movimientos (voice_entry_service.py) y el de metas (goal_voice_service.py).
- **`rules/personal_vocabulary.py`** — Correccion personalizada: compara cada palabra del transcript contra el vocabulario REAL de este usuario (nombres de sus wallets, categorias que usa, titulos de sus metas existentes) usando similitud de texto (difflib, stdlib, sin ML/API externa).
- **`rules/static_terms.py`** — Reglas GLOBALES (iguales para todos los usuarios).
