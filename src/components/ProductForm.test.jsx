import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductForm from './ProductForm'

describe('ProductForm', () => {
  it('no muestra el campo de código de barras', () => {
    render(
      <ProductForm
        product={null}
        products={[]}
        busy={false}
        onSave={() => {}}
        onCancel={() => {}}
      />
    )

    expect(screen.queryByText(/Código de barras/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/código de barras/i)
  })
})
