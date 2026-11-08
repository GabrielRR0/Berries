import { describe, expect, it } from 'vitest'

// Candado de la carpeta bankStatement/ (reglas del proyecto: archivos chicos y tipados faciles de leer).
// Se leen los archivos como texto, sin ejecutarlos.
const files = import.meta.glob('../bankStatement/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const entries = Object.entries(files)

const MAX_LINES = 180

// Tipos "complejos" que no se quieren en estos archivos: se declara una interface plana en su lugar.
const COMPLEX_TYPES = /ReturnType<|Parameters<|Awaited<|Partial<|Record<|<any>|: any\b|as any\b/

describe('carpeta bankStatement (estructura)', () => {
  it('tiene archivos', () => {
    expect(entries.length).toBeGreaterThan(10)
  })

  it(`ningun archivo pasa de ${MAX_LINES} lineas`, () => {
    const tooLong = entries.filter(([, text]) => text.split('\n').length > MAX_LINES).map(([path]) => path)

    expect(tooLong).toEqual([])
  })

  it('toda funcion declara su tipo de retorno de forma explicita', () => {
    const missing: string[] = []
    for (const [path, text] of entries) {
      for (const signature of text.match(/^(export )?function .*$/gm) ?? []) {
        if (!/\)\s*:\s*\S.*\{\s*$/.test(signature)) missing.push(`${path}: ${signature.trim()}`)
      }
    }

    expect(missing).toEqual([])
  })

  it('no usa tipos complejos ni any', () => {
    const complex = entries
      .map(([path, text]) => [path, text.split('\n').filter((lineText) => COMPLEX_TYPES.test(lineText) && !lineText.trim().startsWith('//'))] as const)
      .filter(([, lines]) => lines.length > 0)
      .map(([path, lines]) => `${path}: ${lines[0]!.trim()}`)

    expect(complex).toEqual([])
  })

  it('el padre (index.ts) solo importa y exporta, sin logica', () => {
    const parent = entries.find(([path]) => path.endsWith('/bankStatement/index.ts'))![1]
    const code = parent.split('\n').filter((lineText) => lineText.trim() !== '' && !lineText.trim().startsWith('//'))

    expect(code.every((lineText) => lineText.startsWith('export ') || lineText.startsWith('import '))).toBe(true)
  })
})
