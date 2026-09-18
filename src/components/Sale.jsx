import { useMemo, useState } from 'react'
import { formatMoney, LOW_STOCK } from '../lib/utils'
import { useToast } from './Toast'

export default function Sale({ products, onConfirmSale }) {
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])
  const [cash, setCash] = useState('')
  const [showCart, setShowCart] = useState(false)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return products
    return products.filter((p) => {
      const bag = [p.name, p.description, ...(p.tags || [])].join(' ').toLowerCase()
      return bag.includes(term)
    })
  }, [products, q])

  const favorites = products.filter((p) => p.favorite)
  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0)
  const cashNum = cash === '' ? null : Number(cash)
  const change = cashNum == null || Number.isNaN(cashNum) ? null : cashNum - total
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)

  function qtyInCart(id) {
    return cart.find((i) => i.productId === id)?.qty || 0
  }

  function add(product) {
    const inCart = qtyInCart(product.id)
    if (product.stock != null && inCart + 1 > product.stock) {
      push('No hay suficiente stock', 'error')
      return
    }
    setCart((prev) => {
      const found = prev.find((i) => i.productId === product.id)
      if (found) {
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          photo: product.photo,
        },
      ]
    })
    push(`Agregado: ${product.name}`)
    if (window.matchMedia('(max-width: 1023px)').matches) setShowCart(true)
  }

  function setQty(productId, qty) {
    const product = products.find((p) => p.id === productId)
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId))
      push('Producto quitado del carrito', 'warn')
      return
    }
    if (product?.stock != null && qty > product.stock) {
      push('No hay suficiente stock', 'error')
      return
    }
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty } : i)))
  }

  async function confirm() {
    if (!cart.length) {
      push('El carrito está vacío', 'error')
      return
    }
    if (cashNum == null || Number.isNaN(cashNum)) {
      push('Ingresa el dinero entregado', 'error')
      return
    }
    if (cashNum < total) {
      push(`Falta dinero. Aún restan ${formatMoney(total - cashNum)}`, 'error')
      return
    }
    await onConfirmSale({
      items: cart.map((i) => ({
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        price: i.price,
        subtotal: i.qty * i.price,
      })),
      total,
      cashGiven: cashNum,
      change: cashNum - total,
    })
    setCart([])
    setCash('')
    setShowCart(false)
    push('Venta confirmada')
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      total={total}
      cash={cash}
      change={change}
      onCash={setCash}
      onQty={setQty}
      onConfirm={confirm}
    />
  )

  return (
    <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_380px]">
      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, descripción o etiqueta…"
          className="mb-4 min-h-16 w-full rounded-2xl border border-stone-200 bg-white px-5 text-base shadow-sm dark:border-stone-700 dark:bg-stone-800 sm:text-xl"
        />

        {favorites.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Venta rápida</h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {favorites.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  className="min-h-16 shrink-0 rounded-2xl bg-amber-400 px-4 text-left font-bold text-stone-900 shadow-sm"
                >
                  <div className="text-base">{p.name}</div>
                  <div className="text-sm opacity-80">{formatMoney(p.price)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          {filtered.map((p) => {
            const low = p.stock != null && p.stock <= LOW_STOCK
            const out = p.stock != null && p.stock <= 0
            return (
              <button
                key={p.id}
                onClick={() => add(p)}
                disabled={out}
                className="animate-pop flex gap-3 rounded-3xl bg-white p-3 text-left shadow-card transition active:scale-[0.98] disabled:opacity-50 dark:bg-stone-800"
              >
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-700">
                  {p.photo ? (
                    <img src={p.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-stone-400">Foto</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold leading-tight">{p.name}</h3>
                    {low && (
                      <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                        {out ? 'Agotado' : 'Bajo'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500">{p.description || 'Sin descripción'}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xl font-black text-clay-600 dark:text-clay-400">{formatMoney(p.price)}</span>
                    <span className="rounded-xl bg-clay-500 px-3 py-2 text-sm font-bold text-white">Agregar</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {filtered.length === 0 && (
          <p className="mt-8 text-center text-lg text-stone-500">Ningún producto coincide con “{q}”.</p>
        )}
      </div>

      <aside className="hidden lg:block">{cartPanel}</aside>

      <button
        onClick={() => setShowCart(true)}
        className="fixed bottom-24 right-4 z-30 flex min-h-16 items-center gap-3 rounded-full bg-clay-500 px-5 text-lg font-bold text-white shadow-lg lg:hidden"
      >
        Carrito · {cartCount} · {formatMoney(total)}
      </button>

      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setShowCart(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-stone-100 p-3 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-center">
              <div className="h-1.5 w-16 rounded-full bg-stone-300" />
            </div>
            {cartPanel}
          </div>
        </div>
      )}
    </section>
  )
}

function CartPanel({ cart, total, cash, change, onCash, onQty, onConfirm }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-stone-800">
      <h2 className="mb-3 text-2xl font-black">Carrito</h2>
      <div className="max-h-[40vh] space-y-2 overflow-y-auto lg:max-h-[32vh]">
        {cart.length === 0 && <p className="text-stone-500">Toca un producto para agregarlo.</p>}
        {cart.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 rounded-2xl bg-stone-50 p-2 dark:bg-stone-900">
            <div className="h-12 w-12 overflow-hidden rounded-xl bg-stone-200">
              {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{item.name}</div>
              <div className="text-sm text-stone-500">{formatMoney(item.qty * item.price)}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onQty(item.productId, item.qty - 1)}
                className="min-h-11 min-w-11 rounded-xl bg-stone-200 text-xl font-bold dark:bg-stone-700"
              >
                −
              </button>
              <span className="min-w-8 text-center text-lg font-black">{item.qty}</span>
              <button
                onClick={() => onQty(item.productId, item.qty + 1)}
                className="min-h-11 min-w-11 rounded-xl bg-stone-200 text-xl font-bold dark:bg-stone-700"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
        <div className="flex items-center justify-between text-xl font-black">
          <span>Total a pagar</span>
          <span className="text-clay-600 dark:text-clay-400">{formatMoney(total)}</span>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold text-stone-500">Dinero entregado por el cliente</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={cash}
            onChange={(e) => onCash(e.target.value)}
            className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-xl font-bold dark:border-stone-600 dark:bg-stone-900"
            placeholder="0.00"
          />
        </label>
        <div
          className={`mt-3 rounded-2xl px-4 py-3 text-lg font-bold ${
            change == null
              ? 'bg-stone-100 text-stone-500 dark:bg-stone-900'
              : change < 0
                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {change == null
            ? 'Vuelto: —'
            : change < 0
              ? `Falta ${formatMoney(-change)}`
              : `Vuelto a entregar: ${formatMoney(change)}`}
        </div>
        <button
          onClick={onConfirm}
          className="mt-4 min-h-16 w-full rounded-2xl bg-leaf-500 text-xl font-black text-white"
        >
          Confirmar venta
        </button>
      </div>
    </div>
  )
}
