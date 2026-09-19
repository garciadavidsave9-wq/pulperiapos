export function normalizeBarcode(value = '') {
  const normalized = String(value ?? '').replace(/[^\d]/g, '')
  return normalized
}

export function findDuplicateProduct(products = [], barcode, currentId = null) {
  const normalized = normalizeBarcode(barcode)
  if (!normalized) return null

  return (products || []).find((product) => {
    if (product?.id === currentId) return false
    const existing = normalizeBarcode(product?.codigo_barras || product?.barcode || '')
    return Boolean(existing) && existing === normalized
  }) || null
}

export function parseOpenFoodFactsProduct(payload) {
  const product = payload?.product
  if (!product) return null

  const name = (product.product_name || product.product_name_en || product.generic_name || '').trim()
  const description = (product.generic_name || product.ingredients_text || product.categories || '').trim()

  if (!name && !description) return null

  return {
    name: name || 'Producto sin nombre',
    description: description || 'Sin descripción disponible.',
  }
}

export async function fetchProductFromOpenFoodFacts(code) {
  const normalized = normalizeBarcode(code)
  if (!normalized) return null

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${normalized}.json`)
    if (!response.ok) return null

    const payload = await response.json()
    if (!payload?.product) return null

    return parseOpenFoodFactsProduct(payload)
  } catch {
    return null
  }
}
