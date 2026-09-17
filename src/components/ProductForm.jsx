import { useEffect, useMemo, useState } from 'react'
import { compressImage } from '../lib/utils'
import { LOW_STOCK, parseTags } from '../lib/utils'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

const EMPTY = {
  name: '',
  description: '',
  price: '',
  tags: '',
  stock: '',
  favorite: false,
  photo: '',
}

export default function ProductForm({ product, onSave, onCancel, busy }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [photoInfo, setPhotoInfo] = useState('')

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        description: product.description || '',
        price: product.price ?? '',
        tags: (product.tags || []).join(', '),
        stock: product.stock ?? '',
        favorite: Boolean(product.favorite),
        photo: product.photo || '',
      })
      setPhotoInfo('')
    } else {
      setForm(EMPTY)
    }
    setError('')
  }, [product])

  const title = product ? 'Editar producto' : 'Nuevo producto'
  const low = useMemo(() => {
    if (form.stock === '' || form.stock == null) return false
    return Number(form.stock) <= LOW_STOCK
  }, [form.stock])

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    setError('')
    try {
      const result = await compressImage(file)
      if (hasSupabaseConfig() && supabase) {
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`
        const { data, error } = await supabase.storage.from('product-photos').upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        })
        if (error) throw error
        const { data: publicUrlData } = supabase.storage.from('product-photos').getPublicUrl(data.path)
        setForm((prev) => ({ ...prev, photo: publicUrlData.publicUrl }))
      } else {
        setForm((prev) => ({ ...prev, photo: result.dataUrl }))
      }
      setPhotoInfo(`${result.width}×${result.height} · ${Math.round(result.bytes / 1024)} KB`)
    } catch {
      setError('No se pudo comprimir o subir la foto. Prueba con otra imagen.')
    } finally {
      setCompressing(false)
      e.target.value = ''
    }
  }

  function submit(e) {
    e.preventDefault()
    const name = form.name.trim()
    const price = Number(form.price)
    if (!name) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('El precio es obligatorio y debe ser un número válido.')
      return
    }
    onSave({
      name,
      description: form.description.trim(),
      price,
      tags: parseTags(form.tags),
      stock: form.stock === '' ? null : Number(form.stock),
      favorite: form.favorite,
      photo: form.photo,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <form
        onSubmit={submit}
        className="animate-pop max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-stone-800"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 min-w-12 rounded-2xl bg-stone-100 px-4 text-xl dark:bg-stone-700"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">Nombre *</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg dark:border-stone-600 dark:bg-stone-900"
              placeholder="Ej. Coca-Cola fresca 600ml"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">Descripción</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-lg dark:border-stone-600 dark:bg-stone-900"
              placeholder="Detalles para buscar más fácil"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">Precio *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg dark:border-stone-600 dark:bg-stone-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">
              Cantidad disponible
            </span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg dark:border-stone-600 dark:bg-stone-900"
              placeholder="Opcional"
            />
            {low && (
              <p className="mt-1 text-sm font-semibold text-amber-600">Quedará marcado como stock bajo.</p>
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">
              Categorías / etiquetas
            </span>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg dark:border-stone-600 dark:bg-stone-900"
              placeholder="bebida, snack, fresca"
            />
          </label>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">Fotografía</span>
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-28 w-28 overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-700">
                {form.photo ? (
                  <img src={form.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400">Sin foto</div>
                )}
              </div>
              <label className="min-h-14 cursor-pointer rounded-2xl bg-clay-500 px-5 py-3 text-lg font-semibold text-white">
                {compressing ? 'Comprimiendo…' : 'Subir foto'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
              </label>
              {form.photo && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, photo: '' })
                    setPhotoInfo('')
                  }}
                  className="min-h-14 rounded-2xl bg-stone-200 px-4 font-semibold dark:bg-stone-700"
                >
                  Quitar
                </button>
              )}
            </div>
            {photoInfo && <p className="mt-2 text-sm text-stone-500">Comprimida: {photoInfo}</p>}
          </div>
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-stone-100 px-4 dark:bg-stone-900 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(e) => setForm({ ...form, favorite: e.target.checked })}
              className="h-6 w-6 accent-clay-500"
            />
            <span className="text-lg font-semibold">Marcar como venta rápida (favorito)</span>
          </label>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-red-100 px-4 py-3 font-semibold text-red-700">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-14 rounded-2xl bg-stone-200 text-lg font-bold dark:bg-stone-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || compressing}
            className="min-h-14 rounded-2xl bg-clay-500 text-lg font-bold text-white disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}
