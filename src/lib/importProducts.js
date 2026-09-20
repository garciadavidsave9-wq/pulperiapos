import { normalizeBarcode } from './barcode'
import { parseTags } from './utils'

const HEADER_ALIASES = {
  nombre: 'nombre',
  name: 'nombre',
  product: 'nombre',
  descripcion: 'descripcion',
  description: 'descripcion',
  'descripción': 'descripcion',
  precio: 'precio',
  price: 'precio',
  'cantidad disponible': 'cantidadDisponible',
  cantidad: 'cantidadDisponible',
  stock: 'cantidadDisponible',
  'categorías / etiquetas': 'categorias',
  'categorias / etiquetas': 'categorias',
  categorias: 'categorias',
  tags: 'categorias',
  etiquetas: 'categorias',
  'codigo de barras': 'codigoBarras',
  'código de barras': 'codigoBarras',
  barcode: 'codigoBarras',
  codigo_barras: 'codigoBarras',
}

function normalizeHeader(value = '') {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .replace(/[\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickValue(row, aliases) {
  if (!row || typeof row !== 'object') return ''
  const normalizedKeys = Object.keys(row).reduce((acc, key) => {
    acc[normalizeHeader(key)] = row[key]
    return acc
  }, {})

  for (const alias of aliases) {
    const canonical = HEADER_ALIASES[normalizeHeader(alias)] || normalizeHeader(alias)
    if (normalizedKeys[canonical] !== undefined && normalizedKeys[canonical] !== null) {
      return normalizedKeys[canonical]
    }
  }

  for (const key of Object.keys(normalizedKeys)) {
    if (aliases.some((alias) => normalizeHeader(alias) === key)) {
      return normalizedKeys[key]
    }
  }

  return ''
}

export function parseImportedRows(rows = []) {
  const validRows = []
  const invalidRows = []

  rows.forEach((row, index) => {
    const rawName = pickValue(row, ['Nombre', 'nombre', 'name'])
    const rawDescription = pickValue(row, ['Descripción', 'descripcion', 'description'])
    const rawPrice = pickValue(row, ['Precio', 'precio', 'price'])
    const rawStock = pickValue(row, ['Cantidad disponible', 'cantidad', 'stock'])
    const rawTags = pickValue(row, ['Categorías / etiquetas', 'categorias', 'tags', 'etiquetas'])
    const rawBarcode = pickValue(row, ['Código de barras', 'codigo de barras', 'barcode', 'codigo_barras'])

    const name = String(rawName ?? '').trim()
    if (!name) {
      invalidRows.push({ rowIndex: index + 2, reason: 'Falta Nombre en la fila.', raw: row })
      return
    }

    const rawPriceText = String(rawPrice ?? '').trim()
    if (!rawPriceText) {
      invalidRows.push({ rowIndex: index + 2, reason: 'Falta Precio en la fila.', raw: row })
      return
    }

    const priceValue = Number(rawPriceText.replace(/[^0-9.,-]/g, '').replace(',', '.'))
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      invalidRows.push({ rowIndex: index + 2, reason: 'Precio inválido en la fila.', raw: row })
      return
    }

    const stockValue = String(rawStock ?? '').trim()
    const parsedStock = stockValue === '' ? null : Number(String(rawStock).replace(/[^0-9.,-]/g, '').replace(',', '.'))

    validRows.push({
      name,
      description: String(rawDescription ?? '').trim(),
      price: Number(priceValue.toFixed(2)),
      stock: Number.isFinite(parsedStock) && Number(parsedStock) >= 0 ? Number(parsedStock) : null,
      tags: parseTags(String(rawTags ?? '')),
      codigo_barras: normalizeBarcode(rawBarcode || ''),
      favorite: false,
      photo: '',
    })
  })

  return { validRows, invalidRows }
}
