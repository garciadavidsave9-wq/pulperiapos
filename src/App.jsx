import { useEffect, useState } from 'react'
import { ToastProvider, useToast } from './components/Toast'
import Inventory from './components/Inventory'
import Sale from './components/Sale'
import Calculator from './components/Calculator'
import History from './components/History'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import { deleteItem, exportAll, getAll, importAll, putItem, uid } from './lib/db'
import { seedIfNeeded } from './lib/seed'

const NAV = [
  { id: 'sale', label: 'Venta', icon: '🛒' },
  { id: 'inventory', label: 'Inventario', icon: '📦' },
  { id: 'history', label: 'Historial', icon: '🧾' },
  { id: 'calc', label: 'Calculadora', icon: '🧮' },
]

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}

function Shell() {
  const { push } = useToast()
  const [tab, setTab] = useState('sale')
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [dark, setDark] = useState(() => localStorage.getItem('pos-theme') === 'dark')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('pos-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (hasSupabaseConfig() && supabase) {
        try {
          const { data: productsData, error: productsError } = await supabase.from('products').select('*').order('name')
          const { data: salesData, error: salesError } = await supabase.from('ventas').select('*').order('created_at', { ascending: false })

          if (productsError) throw productsError
          if (salesError) throw salesError

          const normalizedProducts = (productsData || []).map((item) => ({
            ...item,
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: Number(item.price_lempiras || 0),
            tags: Array.isArray(item.tags) ? item.tags : [],
            stock: item.stock == null ? null : Number(item.stock),
            favorite: Boolean(item.favorite),
            photo: item.photo_url || '',
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          }))

          const normalizedSales = (salesData || []).map((sale) => ({
            id: sale.id,
            total: Number(sale.total_lempiras || 0),
            cashGiven: Number(sale.cash_given_lempiras || 0),
            change: Number(sale.change_lempiras || 0),
            createdAt: sale.created_at,
            items: [],
          }))

          if (!alive) return
          setProducts(normalizedProducts)
          setSales(normalizedSales)
          setReady(true)
          return
        } catch (error) {
          console.error('Supabase load error:', error)
        }
      }

      await seedIfNeeded()
      const [p, s] = await Promise.all([getAll('products'), getAll('sales')])
      if (!alive) return
      setProducts(p.sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setSales(s.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  async function refresh() {
    if (hasSupabaseConfig() && supabase) {
      const [productsRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('ventas').select('*').order('created_at', { ascending: false }),
      ])
      const normalizedProducts = (productsRes.data || []).map((item) => ({
        ...item,
        price: Number(item.price_lempiras || 0),
        tags: Array.isArray(item.tags) ? item.tags : [],
        stock: item.stock == null ? null : Number(item.stock),
        favorite: Boolean(item.favorite),
        photo: item.photo_url || '',
      }))
      const normalizedSales = (salesRes.data || []).map((sale) => ({
        id: sale.id,
        total: Number(sale.total_lempiras || 0),
        cashGiven: Number(sale.cash_given_lempiras || 0),
        change: Number(sale.change_lempiras || 0),
        createdAt: sale.created_at,
        items: [],
      }))
      setProducts(normalizedProducts)
      setSales(normalizedSales)
      return
    }
    const [p, s] = await Promise.all([getAll('products'), getAll('sales')])
    setProducts(p.sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setSales(s.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async function saveProduct(data) {
    const now = new Date().toISOString()
    const item = {
      ...data,
      id: data.id || uid('prd'),
      createdAt: data.createdAt || now,
      updatedAt: now,
    }

    if (hasSupabaseConfig() && supabase) {
      const { error } = await supabase.from('products').upsert({
        id: item.id,
        name: item.name,
        description: item.description || '',
        price_lempiras: Number(item.price || 0),
        tags: Array.isArray(item.tags) ? item.tags : [],
        stock: item.stock == null ? null : Number(item.stock),
        favorite: Boolean(item.favorite),
        photo_url: item.photo || '',
        created_at: item.createdAt || now,
        updated_at: now,
      })
      if (error) {
        throw error
      }
      await refresh()
      push(data.id ? 'Producto actualizado' : 'Producto guardado')
      return
    }

    await putItem('products', item)
    await refresh()
    push(data.id ? 'Producto actualizado' : 'Producto guardado')
  }

  async function removeProduct(id) {
    if (hasSupabaseConfig() && supabase) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) {
        throw error
      }
      await refresh()
      push('Producto eliminado', 'warn')
      return
    }
    await deleteItem('products', id)
    await refresh()
    push('Producto eliminado', 'warn')
  }

  async function confirmSale(payload) {
    const saleId = uid('sale')
    const sale = {
      id: saleId,
      ...payload,
      createdAt: new Date().toISOString(),
    }

    if (hasSupabaseConfig() && supabase) {
      const { error: saleError } = await supabase.from('ventas').insert({
        id: saleId,
        total_lempiras: Number(payload.total || 0),
        cash_given_lempiras: Number(payload.cashGiven || 0),
        change_lempiras: Number(payload.change || 0),
        created_at: sale.createdAt,
      })
      if (saleError) {
        throw saleError
      }

      const details = payload.items.map((line) => ({
        id: uid('det'),
        sale_id: saleId,
        product_id: line.productId,
        name: line.name,
        qty: Number(line.qty || 0),
        price_lempiras: Number(line.price || 0),
        subtotal_lempiras: Number((line.qty || 0) * (line.price || 0)),
        created_at: sale.createdAt,
      }))

      const { error: detailError } = await supabase.from('detalle_venta').insert(details)
      if (detailError) {
        throw detailError
      }

      for (const line of payload.items) {
        const product = products.find((p) => p.id === line.productId)
        if (!product || product.stock == null) continue
        await supabase.from('products').update({
          stock: Math.max(0, Number(product.stock) - line.qty),
          updated_at: new Date().toISOString(),
        }).eq('id', product.id)
      }
      await refresh()
      return
    }

    await putItem('sales', sale)
    for (const line of payload.items) {
      const product = products.find((p) => p.id === line.productId)
      if (!product || product.stock == null) continue
      await putItem('products', {
        ...product,
        stock: Math.max(0, Number(product.stock) - line.qty),
        updatedAt: new Date().toISOString(),
      })
    }
    await refresh()
  }

  async function backup() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pulperia-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    push('Respaldo descargado')
  }

  async function restore(file) {
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      await importAll(payload)
      await refresh()
      push('Datos restaurados')
    } catch {
      push('No se pudo importar el archivo', 'error')
    }
  }

  return (
    <div className="min-h-dvh bg-[#f4ece3] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#f4ece3]/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-clay-600">Pulpería</p>
            <h1 className="text-2xl font-black leading-none">Punto de venta</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((v) => !v)}
              className="min-h-12 rounded-2xl bg-white px-4 font-bold shadow-sm dark:bg-stone-800"
            >
              {dark ? 'Claro' : 'Oscuro'}
            </button>
            <button onClick={backup} className="min-h-12 rounded-2xl bg-white px-4 font-bold shadow-sm dark:bg-stone-800">
              Exportar
            </button>
            <label className="min-h-12 cursor-pointer rounded-2xl bg-white px-4 py-3 font-bold shadow-sm dark:bg-stone-800">
              Importar
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) restore(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-2 px-4 pb-3 md:flex">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`min-h-12 flex-1 rounded-2xl text-lg font-bold ${
                tab === item.id ? 'bg-clay-500 text-white' : 'bg-white dark:bg-stone-800'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 pb-28 md:pb-8">
        {!ready ? (
          <p className="py-16 text-center text-lg text-stone-500">Cargando…</p>
        ) : (
          <>
            {tab === 'inventory' && (
              <Inventory products={products} onSave={saveProduct} onDelete={removeProduct} />
            )}
            {tab === 'sale' && <Sale products={products} onConfirmSale={confirmSale} />}
            {tab === 'calc' && <Calculator />}
            {tab === 'history' && <History sales={sales} />}
          </>
        )}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-stone-200 bg-[#f4ece3]/95 p-2 dark:border-stone-800 dark:bg-stone-950/95 md:hidden">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-16 rounded-2xl text-sm font-bold ${
              tab === item.id ? 'bg-clay-500 text-white' : 'bg-white dark:bg-stone-800'
            }`}
          >
            <div className="text-xl">{item.icon}</div>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
