import { useEffect, useRef, useState } from 'react'

const KEYS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+']

export default function Calculator() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('')
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight)
  const inputRef = useRef(null)

  useEffect(() => {
    const node = inputRef.current
    if (node) node.focus()
  }, [])

  useEffect(() => {
    const updateOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight)
    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', updateOrientation)
    return () => {
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', updateOrientation)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key
      const isNumber = /^[0-9]$/.test(key)
      const isOperator = ['+', '-', '*', '/', '%', '.'].includes(key)
      const isNumpadOperator = ['Add', 'Subtract', 'Multiply', 'Divide'].includes(key)

      if (isNumber || isOperator || isNumpadOperator) {
        event.preventDefault()
        press(mapKeyToExpression(key))
        return
      }

      if (key === 'Enter' || key === '=') {
        event.preventDefault()
        equals()
        return
      }

      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault()
        back()
        return
      }

      if (key === 'Escape' || key === 'c' || key === 'C') {
        event.preventDefault()
        clear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expr])

  function mapKeyToExpression(key) {
    if (key === 'Add') return '+'
    if (key === 'Subtract') return '-'
    if (key === 'Multiply') return '*'
    if (key === 'Divide') return '/'
    return key
  }

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
    <section className="mx-auto max-w-2xl">
      <div
        className={`rounded-3xl bg-white p-4 shadow-card dark:bg-stone-800 ${
          isLandscape ? 'mx-auto flex max-w-3xl items-start gap-4 p-5' : 'max-w-md'
        }`}
      >
        <div className={`${isLandscape ? 'flex-1' : ''}`}>
          <h2 className="mb-3 text-xl font-black sm:text-2xl">Calculadora</h2>
          <input
            ref={inputRef}
            value={expr || '0'}
            readOnly
            onFocus={() => inputRef.current?.focus()}
            onClick={() => inputRef.current?.focus()}
            className="mb-4 min-h-24 w-full rounded-2xl bg-stone-100 p-4 text-right text-lg font-bold text-stone-800 outline-none ring-0 focus:ring-0 dark:bg-stone-900 dark:text-stone-50 sm:text-xl"
            aria-label="Pantalla de calculadora"
          />
          <div className="mb-4 min-h-16 rounded-2xl bg-stone-100 p-3 text-right dark:bg-stone-900">
            <div className="text-3xl font-black sm:text-4xl">{result || ' '}</div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={clear} className="min-h-16 rounded-2xl bg-red-500 text-lg font-black text-white sm:text-xl">
              Limpiar
            </button>
            <button onClick={back} className="min-h-16 rounded-2xl bg-stone-200 text-lg font-black dark:bg-stone-700 sm:text-xl">
              Borrar
            </button>
          </div>
        </div>

        <div className={`${isLandscape ? 'w-full max-w-[26rem]' : 'w-full'}`}>
          <div className="grid grid-cols-4 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                onClick={() => press(key)}
                className={`min-h-16 rounded-2xl text-xl font-black sm:text-2xl ${
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
              className="col-span-4 min-h-16 rounded-2xl bg-leaf-500 text-xl font-black text-white sm:text-2xl"
            >
              =
            </button>
          </div>
        </div>
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
