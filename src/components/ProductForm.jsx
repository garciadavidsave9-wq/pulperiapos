import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { compressImage, dataUrlToBlob, isValidImageFile } from '../lib/utils'
import { LOW_STOCK, parseTags } from '../lib/utils'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { fetchProductFromOpenFoodFacts, findDuplicateProduct, normalizeBarcode } from '../lib/barcode'

const EMPTY = {
  name: '',
  description: '',
  codigo_barras: '',
  price: '',
  tags: '',
  stock: '',
  favorite: false,
  photo: '',
}

export default function ProductForm({ product, products = [], onSave, onCancel, busy, onEditExisting }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [photoInfo, setPhotoInfo] = useState('')
  const [scanInfo, setScanInfo] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerBusy, setScannerBusy] = useState(false)
  const [duplicateProduct, setDuplicateProduct] = useState(null)

  const scannerRef = useRef(null)

  function formatScannerError(stage, err) {
    const name = err?.name || 'Error'
    const message = err?.message || 'Sin detalle disponible.'
    return `Escáner (${stage}) falló: ${name}: ${message}`
  }

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        description: product.description || '',
        codigo_barras: product.codigo_barras || '',
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
    setScanInfo('')
    setDuplicateProduct(null)
    return () => {
      stopScanner()
    }
  }, [product])

  const title = product ? 'Editar producto' : 'Nuevo producto'
  const low = useMemo(() => {
    if (form.stock === '' || form.stock == null) return false
    return Number(form.stock) <= LOW_STOCK
  }, [form.stock])

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // Ignora errores de cierre del scanner.
      }
      scannerRef.current = null
    }
  }

  async function handleScannedCode(rawValue) {
    const normalized = normalizeBarcode(rawValue)
    if (!normalized) {
      setError('No se pudo leer un código válido. Intenta otra vez.')
      return
    }

    setForm((prev) => ({ ...prev, codigo_barras: normalized }))
    setScanInfo('Código detectado. Verificando producto…')
    setError('')
    setDuplicateProduct(null)

    const duplicate = findDuplicateProduct(products, normalized, product?.id)
    if (duplicate) {
      setDuplicateProduct(duplicate)
      setScanInfo('')
      setError('Este producto ya existe.')
      await stopScanner()
      setScannerOpen(false)
      return
    }

    try {
      const productMatch = await fetchProductFromOpenFoodFacts(normalized)
      if (productMatch) {
        setForm((prev) => ({
          ...prev,
          name: productMatch.name || prev.name,
          description: productMatch.description || prev.description,
          codigo_barras: normalized,
        }))
        setScanInfo('Datos cargados desde Open Food Facts. Puedes corregirlos antes de guardar.')
        setError('')
      } else {
        setScanInfo('Producto no encontrado, completa los datos manualmente.')
      }
    } catch {
      setScanInfo('Producto no encontrado, completa los datos manualmente.')
    } finally {
      await stopScanner()
      setScannerOpen(false)
    }
  }

  useEffect(() => {
    if (!scannerOpen) return

    let cancelled = false

    const initializeCamera = async () => {
      try {
        setScannerBusy(true)
        setError('')
        setScanInfo('Solicitando acceso a la cámara…')

        const containerId = 'barcode-reader'
        let container = document.getElementById(containerId)
        if (!container) {
          container = document.createElement('div')
          container.id = containerId
          container.style.display = 'block'
          container.style.width = '100%'
          container.style.maxWidth = '420px'
          container.style.margin = '0 auto'
          document.body.appendChild(container)
        }

        if (cancelled) return

        const html5QrCode = new Html5Qrcode(containerId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.33,
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          async (decodedText) => {
            await handleScannedCode(decodedText)
            try {
              await html5QrCode.stop()
            } catch {
              // Ignora cierre del escáner.
            }
            setScannerOpen(false)
          },
          () => {
            // Ignoramos los frames sin lectura; se reintenta automáticamente.
          },
          ['EAN_13', 'UPC_A']
        )
      } catch (err) {
        setError(formatScannerError('start()', err))
        setScanInfo('')
        setScannerOpen(false)
      } finally {
        if (!cancelled) {
          setScannerBusy(false)
        }
      }
    }

    const frame = requestAnimationFrame(() => {
      initializeCamera()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
      const container = document.getElementById('barcode-reader')
      if (container && container.dataset.generated === 'true') {
        container.remove()
      }
    }
  }, [scannerOpen])

  async function startScanner() {
    await stopScanner()
    setError('')
    setScanInfo('Preparando cámara…')
    setScannerOpen(true)
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isValidImageFile(file)) {
      setError('Solo se permiten imágenes JPG, PNG o WEBP. Intenta con otra imagen.')
      e.target.value = ''
      return
    }

    setCompressing(true)
    setError('')
    setPhotoInfo('')

    try {
      const result = await compressImage(file, { maxWidth: 700, maxBytes: 130 * 1024, quality: 0.82 })
      const finalSizeKb = Math.max(1, Math.round(result.bytes / 1024))

      if (hasSupabaseConfig() && supabase) {
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`
        const compressedBlob = result.blob || dataUrlToBlob(result.dataUrl)
        const { data, error } = await supabase.storage.from('product-photos').upload(fileName, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        })
        if (error) throw error
        const { data: publicUrlData } = supabase.storage.from('product-photos').getPublicUrl(data.path)
        setForm((prev) => ({ ...prev, photo: publicUrlData.publicUrl }))
      } else {
        setForm((prev) => ({ ...prev, photo: result.dataUrl }))
      }

      setPhotoInfo(`Imagen lista: ${finalSizeKb} KB`)
    } catch (err) {
      const rawMessage = err?.message || 'La imagen no pudo procesarse. Debe intentar con otra imagen.'
      const message = /bucket/i.test(rawMessage)
        ? 'No se pudo subir la foto porque el almacenamiento de imágenes no está disponible. Intenta con otra imagen o consulta la configuración del sistema.'
        : rawMessage.includes('config') || rawMessage.includes('storage')
          ? 'No se pudo subir la foto. Intenta con otra imagen o verifica la configuración del almacenamiento.'
          : 'La imagen no pudo procesarse. Debe intentar con otra imagen.'
      setError(message)
      setForm((prev) => ({ ...prev, photo: '' }))
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
      ...product,
      name,
      codigo_barras: normalizeBarcode(form.codigo_barras || ''),
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
          <div className="block sm:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-600 dark:text-stone-300">Nombre *</span>
              <button
                type="button"
                onClick={startScanner}
                className="rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
              >
                Escanear código de barras
              </button>
            </div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg dark:border-stone-600 dark:bg-stone-900"
              placeholder="Ej. Coca-Cola fresca 600ml"
            />
          </div>

          <div className="block sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-stone-600 dark:text-stone-300">Código de barras</label>
            <input
              value={form.codigo_barras}
              onChange={(e) => setForm({ ...form, codigo_barras: normalizeBarcode(e.target.value) })}
              type="text"
              inputMode="numeric"
              className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg dark:border-stone-600 dark:bg-stone-900"
              placeholder="Escanea o ingresa el código"
            />
          </div>

          {scannerOpen && (
            <div className="sm:col-span-2 overflow-hidden rounded-3xl border border-stone-200 bg-stone-100 p-3 dark:border-stone-700 dark:bg-stone-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">Escáner</p>
                <button
                  type="button"
                  onClick={async () => {
                    await stopScanner()
                    setScannerOpen(false)
                    setScanInfo('')
                  }}
                  className="rounded-xl bg-stone-200 px-3 py-1.5 text-sm font-bold dark:bg-stone-700"
                >
                  Cerrar
                </button>
              </div>
              <div id="barcode-reader" className="aspect-video w-full overflow-hidden rounded-2xl bg-black" />
              <div className="mt-3 flex items-center justify-between gap-2 text-sm text-stone-600 dark:text-stone-300">
                <span>{scannerBusy ? 'Activando cámara…' : 'Apunta al código EAN-13 o UPC-A'}</span>
              </div>
            </div>
          )}

          {duplicateProduct && (
            <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Este producto ya existe: {duplicateProduct.name}</p>
              <button
                type="button"
                onClick={() => {
                  if (onEditExisting) onEditExisting(duplicateProduct)
                  onCancel()
                }}
                className="mt-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-white"
              >
                Editar producto existente
              </button>
            </div>
          )}

          {scanInfo && (
            <p className="sm:col-span-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              {scanInfo}
            </p>
          )}

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
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFile} />
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
            {photoInfo && <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{photoInfo}</p>}
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
