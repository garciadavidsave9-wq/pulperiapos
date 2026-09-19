import { describe, expect, it } from 'vitest'
import { findDuplicateProduct, normalizeBarcode, parseOpenFoodFactsProduct } from './barcode'

describe('barcode helpers', () => {
  it('normaliza códigos EAN-13 y UPC-A sin espacios ni guiones', () => {
    expect(normalizeBarcode(' 1234567890128 ')).toBe('1234567890128')
    expect(normalizeBarcode('1234567890123\n')).toBe('1234567890123')
    expect(normalizeBarcode('012345678905')).toBe('012345678905')
  })

  it('detecta duplicados por código de barras ignorando producto actual', () => {
    const products = [
      { id: 'p1', codigo_barras: '1234567890128', name: 'Existente' },
      { id: 'p2', codigo_barras: '9876543210123', name: 'Otro' },
    ]

    expect(findDuplicateProduct(products, '1234567890128', 'p999')).toEqual(products[0])
    expect(findDuplicateProduct(products, '1234567890128', 'p1')).toBeNull()
  })

  it('extrae nombre y descripción desde Open Food Facts', () => {
    const product = parseOpenFoodFactsProduct({
      product: {
        product_name: 'Coca-Cola 600ml',
        generic_name: 'Bebida carbonatada',
        ingredients_text: 'Agua, azúcar, colorante',
      },
    })

    expect(product).toMatchObject({
      name: 'Coca-Cola 600ml',
      description: 'Bebida carbonatada',
    })
  })
})
