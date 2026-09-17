import { deleteItem, getAll, openDb } from './db'

function svgPhoto(label, bg, fg = '#F6F1E8') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360">
    <rect width="500" height="360" fill="${bg}"/>
    <circle cx="90" cy="80" r="46" fill="rgba(255,255,255,0.14)"/>
    <text x="250" y="200" text-anchor="middle" font-size="42" font-family="Segoe UI, sans-serif" fill="${fg}" font-weight="700">${label}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const SAMPLE_PRODUCTS = [
  {
    slug: 'coca-600',
    name: 'Coca-Cola fresca 600ml',
    description: 'Refresco frío de 600 ml, ideal para el calor.',
    price: 25,
    tags: ['bebida', 'fresca', 'refresco'],
    stock: 12,
    favorite: true,
    photo: svgPhoto('COCA 600', '#1B4332'),
  },
  {
    slug: 'cheetos',
    name: 'Cheetos Bolita 45g',
    description: 'Snack de queso para picar.',
    price: 18,
    tags: ['snack', 'chatarra'],
    stock: 3,
    favorite: true,
    photo: svgPhoto('CHEETOS', '#C45C26'),
  },
  {
    slug: 'bimbo',
    name: 'Pan Bimbo grande',
    description: 'Pan de caja para desayuno y merienda.',
    price: 42,
    tags: ['abarrotes', 'pan'],
    stock: 8,
    favorite: false,
    photo: svgPhoto('BIMBO', '#E08A52'),
  },
  {
    slug: 'huevos',
    name: 'Huevos cartón (30)',
    description: 'Cartón de 30 huevos frescos.',
    price: 115,
    tags: ['abarrotes', 'fresca'],
    stock: 6,
    favorite: true,
    photo: svgPhoto('HUEVOS', '#A3491C'),
  },
  {
    slug: 'nescafe',
    name: 'Nescafé 50g',
    description: 'Café instantáneo para olla o taza.',
    price: 48,
    tags: ['abarrotes', 'café'],
    stock: 4,
    favorite: false,
    photo: svgPhoto('CAFÉ', '#1C1917', '#E08A52'),
  },
]

const SAMPLE_NAMES = new Set(SAMPLE_PRODUCTS.map((p) => p.name))

export async function seedIfNeeded() {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['products', 'meta'], 'readwrite')
    const products = tx.objectStore('products')
    const meta = tx.objectStore('meta')
    const seededReq = meta.get('seeded')
    seededReq.onsuccess = () => {
      if (seededReq.result?.value) return
      const countReq = products.count()
      countReq.onsuccess = () => {
        if (countReq.result > 0) {
          meta.put({ key: 'seeded', value: true })
          return
        }
        const now = new Date().toISOString()
        for (const sample of SAMPLE_PRODUCTS) {
          const { slug, ...rest } = sample
          products.put({
            id: `prd_sample_${slug}`,
            ...rest,
            createdAt: now,
            updatedAt: now,
          })
        }
        meta.put({ key: 'seeded', value: true })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

  await dedupeSampleProducts()
}

async function dedupeSampleProducts() {
  const all = await getAll('products')
  const seen = new Set()
  for (const product of all) {
    if (!SAMPLE_NAMES.has(product.name)) continue
    if (seen.has(product.name)) {
      await deleteItem('products', product.id)
    } else {
      seen.add(product.name)
    }
  }
}
