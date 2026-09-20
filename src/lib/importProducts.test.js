import { describe, expect, it } from 'vitest'
import { parseImportedRows } from './importProducts'

describe('importProducts helpers', () => {
  it('acepta filas válidas y omite las que faltan nombre o precio', () => {
    const rows = [
      {
        Nombre: 'Arroz 5kg',
        Descripción: 'Arroz blanco',
        Precio: 42.5,
        'Cantidad disponible': 10,
        'Categorías / etiquetas': 'grano, básico',
        'Código de barras': '1234567890128',
      },
      {
        Nombre: '',
        Precio: 18,
      },
      {
        Nombre: 'Leche',
        Precio: '',
      },
    ]

    const result = parseImportedRows(rows)

    expect(result.validRows).toHaveLength(1)
    expect(result.invalidRows).toHaveLength(2)
    expect(result.validRows[0]).toMatchObject({
      name: 'Arroz 5kg',
      price: 42.5,
      stock: 10,
    })
    expect(result.invalidRows[0].reason).toContain('Nombre')
    expect(result.invalidRows[1].reason).toContain('Precio')
  })
})
