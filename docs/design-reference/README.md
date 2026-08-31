# Referencia visual de Berries

## Estado actual

El usuario compartió capturas de pantalla de una app llamada "Rial" como referencia de **layout y composición** (no de nombre ni de color — ver decisión de color más abajo). Esas imágenes se compartieron pegadas directamente en el chat de Claude Code, que no puede persistir archivos binarios pegados a disco por su cuenta.

**Pendiente:** guardar los archivos reales de esas capturas en esta carpeta (`berry/docs/design-reference/`) para tener una referencia visual permanente que no dependa de que el chat siga disponible. Mientras tanto, esta descripción textual es la fuente de verdad.

## Qué se toma de las capturas "Rial" (layout, no color)

Pantalla principal ("Inicio"), de arriba a abajo:
1. Header superior: avatar circular con iniciales (arriba-izquierda), logo/wordmark centrado, dos botones circulares de ícono (ayuda "?" y chat/soporte) arriba-derecha.
2. Debajo: label "Mi balance" + ícono de ojo (mostrar/ocultar), número grande de balance, línea pequeña de variación ("vs mes pasado"), fila de chips tipo pill para elegir la moneda de visualización (USD/EUR/USDT/VEF).
3. Grid de 4 botones circulares con label debajo: Calculadora, Movimientos, Cuentas, Ajustes.
4. Dos tarjetas lado a lado: "Ingresos" (badge de flecha arriba) y "Gastos" (badge de flecha abajo).
5. Banner promocional descartable (ícono + título + subtítulo + botón "×").
6. Sección "Mis balances" con botón flotante "+" y tarjetas de cuentas individuales debajo.
7. Barra de navegación inferior flotante tipo pill, con íconos + labels, tab activo resaltado.
8. Tooltips de onboarding tipo coach-mark (fondo oscuro semi-transparente, burbuja con botones "Atrás/Siguiente/Listo").

## Decisión de color: negro y rojo (NO el verde-oliva de las capturas)

Confirmado explícitamente por el usuario durante la revisión del plan: la paleta de Berries es **negro y rojo**, no el verde-oliva de las capturas de referencia. Solo se toma la composición/estructura de pantalla, no el color.

- Fondo: casi negro (`#0a0a0a`–`#111113`), nunca negro puro.
- Tarjetas/superficies: un tono ligeramente más claro que el fondo, borde sutil de 1px o sombra suave, nunca ambos a la vez.
- Texto: casi blanco sobre fondo oscuro, gris medio para texto secundario.
- Acento único: rojo — botón primario, tab activo, montos de gasto, badges de alerta.
- Sin un segundo color (nada de verde para "ingresos" — se usa un tono neutro claro en su lugar, precisamente porque la identidad es "negro y rojo", nada más).
- Dark-only por ahora (sin toggle de modo claro) — desviación deliberada y documentada de la regla "claro y oscuro obligatorios" del `DESIGN.md` raíz del portafolio, porque Berries tiene una identidad de marca fija (como muchas apps de finanzas tipo Revolut/N26).

Ver también [[project_berry_new_project]] en la memoria persistente de Claude Code para el resumen de decisiones de arquitectura de todo el proyecto.
