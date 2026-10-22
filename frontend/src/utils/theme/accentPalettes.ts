// Paletas del color principal (acento) de Berry. El rojo sigue siendo el original y
// el de por defecto; las demas son alternativas modernas elegibles en
// Menu > Apariencia. Cada paleta define los tonos que la UI necesita sobre fondo
// oscuro (la app es dark-only):
// - base/strong: acento "de siempre" (--accent / --accent-strong)
// - bright: relleno vivo para CTA, barras y tiles (--accent-bright)
// - soft/softer/tint: textos y segmentos claros del mismo tono
// - contrast/onBright: texto legible sobre base / sobre bright
export type AccentId = 'red' | 'blue' | 'sky' | 'green' | 'pink' | 'purple'

export interface AccentPalette {
  id: AccentId
  label: string
  description: string
  base: string
  strong: string
  bright: string
  soft: string
  softer: string
  tint: string
  contrast: string
  onBright: string
}

export const DEFAULT_ACCENT_ID: AccentId = 'red'

export const ACCENT_PALETTES: AccentPalette[] = [
  {
    id: 'red',
    label: 'Rojo',
    description: 'El original de Berry',
    base: '#ef4444',
    strong: '#dc2626',
    bright: '#ff5a52',
    soft: '#ff8a83',
    softer: '#ffb3ae',
    tint: '#ffa29b',
    contrast: '#ffffff',
    onBright: '#1a0505',
  },
  {
    id: 'blue',
    label: 'Azul',
    description: 'Sereno y confiable',
    base: '#3b82f6',
    strong: '#2563eb',
    bright: '#5aa0ff',
    soft: '#8dbbff',
    softer: '#b6d3ff',
    tint: '#93c0ff',
    contrast: '#ffffff',
    onBright: '#041226',
  },
  {
    id: 'sky',
    label: 'Cielo',
    description: 'Fresco y ligero',
    base: '#0ea5e9',
    strong: '#0284c7',
    bright: '#38bdf8',
    soft: '#7dd3fc',
    softer: '#bae6fd',
    tint: '#7dd3fc',
    contrast: '#04202e',
    onBright: '#03202e',
  },
  {
    id: 'green',
    label: 'Verde',
    description: 'Calma y crecimiento',
    base: '#10b981',
    strong: '#059669',
    bright: '#34d399',
    soft: '#6ee7b7',
    softer: '#a7f3d0',
    tint: '#6ee7b7',
    contrast: '#03140c',
    onBright: '#03140c',
  },
  {
    id: 'pink',
    label: 'Rosado',
    description: 'Cálido y expresivo',
    base: '#ec4899',
    strong: '#db2777',
    bright: '#f472b6',
    soft: '#f9a8d4',
    softer: '#fbcfe8',
    tint: '#f9a8d4',
    contrast: '#ffffff',
    onBright: '#1f0412',
  },
  {
    id: 'purple',
    label: 'Morado',
    description: 'Creativo y elegante',
    base: '#8b5cf6',
    strong: '#7c3aed',
    bright: '#a78bfa',
    soft: '#c4b5fd',
    softer: '#ddd6fe',
    tint: '#c4b5fd',
    contrast: '#ffffff',
    onBright: '#0f0626',
  },
]

export function findAccentPalette(id: string | null | undefined): AccentPalette {
  return ACCENT_PALETTES.find((palette) => palette.id === id) ?? ACCENT_PALETTES[0]
}

// "#ef4444" -> "239, 68, 68": el CSS arma los tonos con alpha (rgba(var(--accent-rgb), .14)).
export function hexToRgbTriplet(hex: string): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

// Variables CSS que sobreescribe una paleta sobre :root (ver style.css, que define
// el resto - muted, border, glow - a partir de estas).
export function accentCssVariables(palette: AccentPalette): Record<string, string> {
  return {
    '--accent-rgb': hexToRgbTriplet(palette.base),
    '--accent-strong-rgb': hexToRgbTriplet(palette.strong),
    '--accent-bright-rgb': hexToRgbTriplet(palette.bright),
    '--accent-soft': palette.soft,
    '--accent-softer': palette.softer,
    '--accent-tint': palette.tint,
    '--accent-contrast': palette.contrast,
    '--on-accent-bright': palette.onBright,
  }
}
