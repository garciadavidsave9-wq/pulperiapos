import { useState } from 'react'

const KEYS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+']

export default function Calculator() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('')

  function press(key) {
    setResult('')
    setExpr((prev) => prev + key)
  }

  function clear() {
    setExpr('')
    setResult('')
  }

  function back() {
    setExpr((prev) => prev.slice(0, -1))
  }

  function equals() {
    try {
      const value = evaluate(expr)
      if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
        setResult('Error')
        return
      }
      setResult(String(value))
    } catch {
      setResult('Error')
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-3xl bg-white p-5 shadow-card dark:bg-stone-800">
        <h2 className="mb-3 text-2xl font-black">Calculadora</h2>
        <div className="mb-4 min-h-28 rounded-2xl bg-stone-100 p-4 text-right dark:bg-stone-900">
          <div className="break-all text-lg text-stone-500">{expr || '0'}</div>
          <div className="text-4xl font-black">{result || ' '}</div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button onClick={clear} className="min-h-16 rounded-2xl bg-red-500 text-xl font-black text-white">
            Limpiar
          </button>
          <button onClick={back} className="min-h-16 rounded-2xl bg-stone-200 text-xl font-black dark:bg-stone-700">
            Borrar
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => press(key)}
              className={`min-h-16 rounded-2xl text-2xl font-black ${
                '+-*/%'.includes(key)
                  ? 'bg-clay-500 text-white'
                  : 'bg-stone-100 dark:bg-stone-900'
              }`}
            >
              {key}
            </button>
          ))}
          <button
            onClick={equals}
            className="col-span-4 min-h-16 rounded-2xl bg-leaf-500 text-2xl font-black text-white"
          >
            =
          </button>
        </div>
        <p className="mt-3 text-sm text-stone-500">
          Independiente de la venta. El % aplica sobre el número anterior (ej. 200+10% = 220).
        </p>
      </div>
    </section>
  )
}

function evaluate(input) {
  const tokens = String(input)
    .replace(/\s+/g, '')
    .match(/(\d+(\.\d+)?%?|[+\-*/])/g)
  if (!tokens || !tokens.length) return 0

  const values = []
  const ops = []
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 }

  const apply = () => {
    const b = values.pop()
    const a = values.pop()
    const op = ops.pop()
    if (a == null || b == null || !op) throw new Error('bad')
    if (op === '+') values.push(a + b)
    if (op === '-') values.push(a - b)
    if (op === '*') values.push(a * b)
    if (op === '/') values.push(b === 0 ? NaN : a / b)
  }

  let expectNumber = true
  for (const raw of tokens) {
    if (raw === '+' || raw === '-' || raw === '*' || raw === '/') {
      if (expectNumber && raw === '-') {
        values.push(0)
        ops.push('-')
        continue
      }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[raw]) apply()
      ops.push(raw)
      expectNumber = true
      continue
    }
    let n
    if (raw.endsWith('%')) {
      n = Number(raw.slice(0, -1)) / 100
      const prevOp = ops[ops.length - 1]
      const prevVal = values[values.length - 1]
      if ((prevOp === '+' || prevOp === '-') && prevVal != null) {
        n = prevVal * n
      }
    } else {
      n = Number(raw)
    }
    values.push(n)
    expectNumber = false
  }
  while (ops.length) apply()
  return Math.round(values[0] * 1e8) / 1e8
}
