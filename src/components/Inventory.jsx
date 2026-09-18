import { useMemo, useState } from 'react'
import ProductForm from './ProductForm'
import { formatMoney, LOW_STOCK } from '../lib/utils'

export default function Inventory({ products, onSave, onDelete }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return products
    return products.filter((p) => matches(p, term))
  }, [products, q])

  async function save(data) {
    setBusy(true)
    await onSave(editing ? { ...editing, ...data } : data)
    setBusy(false)
    setEditing(null)
    setCreating(false)
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en inventario…"
          className="min-h-14 flex-1 rounded-2xl border border-stone-200 bg-white px-4 text-base shadow-sm dark:border-stone-700 dark:bg-stone-800 sm:text-lg"
        />
        <button
          onClick={() => {
            setEditing(null)
            setCreating(true)
          }}
          className="min-h-14 rounded-2xl bg-clay-500 px-5 text-base font-bold text-white shadow-card sm:px-6 sm:text-lg"
        >
          + Agregar producto
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const low = p.stock != null && p.stock <= LOW_STOCK
          return (
            <article
              key={p.id}
              className="animate-pop overflow-hidden rounded-3xl bg-white shadow-card dark:bg-stone-800"
            >
              <div className="relative h-36 bg-stone-200 dark:bg-stone-700">
                {p.photo ? (
                  <img src={p.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400">Sin foto</div>
                )}
                {p.favorite && (
                  <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-sm font-bold text-stone-900">
                    Rápida
                  </span>
                )}
                {low && (
                  <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
                    Stock bajo
                  </span>
                )}
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-xl font-bold leading-tight">{p.name}</h3>
                <p className="line-clamp-2 text-stone-500 dark:text-stone-400">{p.description || 'Sin descripción'}</p>
                <p className="text-2xl font-black text-clay-600 dark:text-clay-400">{formatMoney(p.price)}</p>
                <p className="text-sm text-stone-500">
                  {p.stock == null ? 'Sin control de stock' : `Disponible: ${p.stock}`}
                  {p.tags?.length ? ` · ${p.tags.join(', ')}` : ''}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setEditing(p)}
                    className="min-h-12 rounded-2xl bg-stone-100 font-bold dark:bg-stone-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar "${p.name}"?`)) onDelete(p.id)
                    }}
                    className="min-h-12 rounded-2xl bg-red-50 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-lg text-stone-500">No hay productos que coincidan.</p>
      )}

      {(creating || editing) && (
        <ProductForm
          product={editing}
          busy={busy}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={save}
        />
      )}
    </section>
  )
}

function matches(p, term) {
  const bag = [p.name, p.description, ...(p.tags || [])].join(' ').toLowerCase()
  return bag.includes(term)
}
