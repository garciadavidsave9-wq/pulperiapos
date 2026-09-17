import { useMemo } from 'react'
import { formatDateTime, formatMoney, isSameDay } from '../lib/utils'

export default function History({ sales }) {
  const today = useMemo(() => sales.filter((s) => isSameDay(s.createdAt)), [sales])
  const report = useMemo(() => buildReport(today), [today])

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Vendido hoy" value={formatMoney(report.total)} />
        <Stat label="Transacciones" value={String(report.count)} />
        <Stat label="Más vendido" value={report.top || '—'} />
      </div>

      <div className="space-y-3">
        {sales.length === 0 && (
          <p className="rounded-3xl bg-white p-8 text-center text-lg text-stone-500 dark:bg-stone-800">
            Aún no hay ventas. Confirma una en la pestaña Venta.
          </p>
        )}
        {sales.map((sale) => (
          <article key={sale.id} className="rounded-3xl bg-white p-4 shadow-card dark:bg-stone-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black">{formatDateTime(sale.createdAt)}</h3>
              <span className="text-xl font-black text-clay-600 dark:text-clay-400">{formatMoney(sale.total)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-stone-600 dark:text-stone-300">
              {sale.items.map((item, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>
                    {item.qty} × {item.name}
                  </span>
                  <span className="font-semibold">{formatMoney(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-stone-500">
              Entregó {formatMoney(sale.cashGiven)} · Vuelto {formatMoney(sale.change)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-stone-800">
      <div className="text-sm font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 break-words text-2xl font-black">{value}</div>
    </div>
  )
}

function buildReport(sales) {
  const total = sales.reduce((sum, s) => sum + s.total, 0)
  const qtyByName = new Map()
  for (const sale of sales) {
    for (const item of sale.items) {
      qtyByName.set(item.name, (qtyByName.get(item.name) || 0) + item.qty)
    }
  }
  let top = null
  let max = 0
  for (const [name, qty] of qtyByName) {
    if (qty > max) {
      max = qty
      top = `${name} (${qty})`
    }
  }
  return { total, count: sales.length, top }
}
