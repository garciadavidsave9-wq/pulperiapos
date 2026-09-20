import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { ToastProvider, useToast } from './components/Toast'
import Inventory from './components/Inventory'
import Sale from './components/Sale'
import Calculator from './components/Calculator'
import History from './components/History'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import { deleteItem, exportAll, getAll, importAll, putItem, uid } from './lib/db'
import { seedIfNeeded } from './lib/seed'
import { parseImportedRows } from './lib/importProducts'

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
  const [importPreview, setImportPreview] = useState([])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)

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
      return true
    }

    await putItem('products', item)
    await refresh()
    push(data.id ? 'Producto actualizado' : 'Producto guardado')
    return true
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

  async function importExcelFile(file) {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        defval: '',
        raw: false,
        blankrows: false,
      })

      const { validRows, invalidRows } = parseImportedRows(rows)
      const preview = [
        ...validRows.map((row) => ({
          status: 'valid',
          name: row.name,
          price: Number(row.price || 0),
          stock: row.stock ?? '',
          reason: '',
          ...row,
        })),
        ...invalidRows.map((row) => ({
          status: 'invalid',
          name: row.raw?.Nombre || row.raw?.nombre || row.raw?.name || 'Sin nombre',
          price: row.raw?.Precio || row.raw?.precio || row.raw?.price || '',
          stock: row.raw?.['Cantidad disponible'] || row.raw?.cantidad || row.raw?.stock || '',
          reason: row.reason,
          ...row.raw,
        })),
      ]

      if (preview.length === 0) {
        push('No se encontraron filas válidas para importar.', 'warn')
        return
      }

      setImportPreview(preview)
      setImportDialogOpen(true)
    } catch {
      push('No se pudo leer el archivo Excel. Revisa que sea un .xlsx válido.', 'error')
    }
  }

  async function confirmImport() {
    const validProducts = importPreview.filter((row) => row.status === 'valid')
    if (!validProducts.length) {
      push('No hay productos válidos para importar.', 'warn')
      return
    }

    setImporting(true)
    const now = new Date().toISOString()
    const payload = validProducts.map((row) => ({
      id: uid('prd'),
      name: String(row.name || '').trim(),
      description: String(row.description || '').trim(),
      price: Number(row.price || 0),
      tags: Array.isArray(row.tags) ? row.tags : [],
      stock: row.stock == null || row.stock === '' ? null : Number(row.stock),
      favorite: Boolean(row.favorite),
      photo: row.photo || '',
      createdAt: now,
      updatedAt: now,
    }))

    try {
      if (hasSupabaseConfig() && supabase) {
        const { error } = await supabase.from('products').insert(
          payload.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description || '',
            price_lempiras: Number(product.price || 0),
            tags: product.tags,
            stock: product.stock == null ? null : Number(product.stock),
            favorite: Boolean(product.favorite),
            photo_url: product.photo || '',
            created_at: product.createdAt,
            updated_at: product.updatedAt,
          }))
        )
        if (error) throw error
      } else {
        for (const product of payload) {
          await putItem('products', product)
        }
      }

      await refresh()
      setImportPreview([])
      setImportDialogOpen(false)
      const importedCount = payload.length
      const omittedCount = importPreview.filter((row) => row.status === 'invalid').length
      push(`${importedCount} productos importados, ${omittedCount} omitidos`)
    } catch (error) {
      console.error(error)
      push('No se pudo guardar la importación. Revisa los datos del archivo.', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#f4ece3] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#f4ece3]/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-clay-600">Pulpería</p>
            <h1 className="text-xl font-black leading-none sm:text-2xl">Punto de venta</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDark((v) => !v)}
              className="min-h-12 rounded-2xl bg-white px-4 text-sm font-bold shadow-sm dark:bg-stone-800 sm:text-base"
            >
              {dark ? 'Claro' : 'Oscuro'}
            </button>
            <button onClick={backup} className="min-h-12 rounded-2xl bg-white px-4 text-sm font-bold shadow-sm dark:bg-stone-800 sm:text-base">
              Exportar
            </button>
            <label className="min-h-12 cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm font-bold shadow-sm dark:bg-stone-800 sm:text-base">
              Importar
              <input
                type="file"
                accept=".json,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const lower = file.name.toLowerCase()
                  if (lower.endsWith('.json')) {
                    restore(file)
                  } else {
                    importExcelFile(file)
                  }
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

      {importDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="animate-pop w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-stone-800">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-700">
              <div>
                <h3 className="text-xl font-black text-stone-800 dark:text-stone-100">Vista previa de importación</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {importPreview.filter((row) => row.status === 'valid').length} productos válidos ·{' '}
                  {importPreview.filter((row) => row.status === 'invalid').length} omitidos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportDialogOpen(false)}
                className="min-h-12 rounded-2xl bg-stone-100 px-4 font-bold dark:bg-stone-700"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300">
                    <th className="px-2 py-3 font-bold">Nombre</th>
                    <th className="px-2 py-3 font-bold">Precio</th>
                    <th className="px-2 py-3 font-bold">Cantidad</th>
                    <th className="px-2 py-3 font-bold">Estado</th>
                    <th className="px-2 py-3 font-bold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="border-b border-stone-100 align-top dark:border-stone-700">
                      <td className="px-2 py-3 font-semibold text-stone-800 dark:text-stone-100">{row.name || 'Sin nombre'}</td>
                      <td className="px-2 py-3 text-stone-700 dark:text-stone-200">{row.price !== '' && row.price !== undefined ? `L. ${Number(row.price).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                      <td className="px-2 py-3 text-stone-700 dark:text-stone-200">{row.stock !== '' && row.stock != null ? row.stock : '-'}</td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            row.status === 'valid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {row.status === 'valid' ? 'Lista' : 'Omitida'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-stone-600 dark:text-stone-300">{row.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-200 px-5 py-4 dark:border-stone-700 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setImportDialogOpen(false)}
                className="min-h-12 rounded-2xl bg-stone-200 px-5 font-bold dark:bg-stone-700"
              >
                Revisar más tarde
              </button>
              <button
                type="button"
                disabled={importing || !importPreview.some((row) => row.status === 'valid')}
                onClick={confirmImport}
                className="min-h-12 rounded-2xl bg-clay-500 px-5 font-bold text-white disabled:opacity-60"
              >
                {importing ? 'Importando…' : 'Confirmar importación'}
              </button>
            </div>
          </div>
        </div>
      )}

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
