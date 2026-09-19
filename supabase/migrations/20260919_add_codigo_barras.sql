ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS codigo_barras text;

CREATE INDEX IF NOT EXISTS idx_products_codigo_barras
ON public.products (codigo_barras);
