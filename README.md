# Pulpería POS

Punto de venta para pulpería con backend en Supabase, almacenamiento de fotos en Supabase Storage y datos sincronizados en la nube.

## Requisitos

- Node.js 18 o superior
- Cuenta gratuita en Supabase
- Google Chrome en la tablet Android

## 1) Crear proyecto gratuito en Supabase

1. Ingresa a https://supabase.com y crea una cuenta gratuita.
2. En el panel, crea un nuevo proyecto.
3. Elige un nombre, por ejemplo: `pulperia-pos`.
4. Define una contraseña segura para la base de datos.
5. Espera a que Supabase cree el proyecto.

## 2) Obtener la URL y la anon key

1. En el proyecto de Supabase, entra a **Project Settings** → **API**.
2. Copia:
   - `Project URL`
   - `anon public key`
3. Guarda esos valores en un lugar seguro; no los compartas en repositorios públicos.

## 3) Configurar variables de entorno en local

Crea un archivo `.env` en la raíz del proyecto con este contenido:

```bash
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Ejemplo real:

```bash
VITE_SUPABASE_URL=https://xyz123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

No hardcodees esas claves en el código ni en GitHub. Para evitar que se suban accidentalmente, usa `.gitignore` y un `.env.example` como referencia.

## 4) Crear las tablas y Storage en Supabase

Abre el **SQL Editor** en Supabase y pega este script:

```sql
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text default '',
  price_lempiras numeric(12,2) not null check (price_lempiras >= 0),
  tags text[] not null default '{}',
  stock integer,
  favorite boolean not null default false,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ventas (
  id text primary key,
  total_lempiras numeric(12,2) not null check (total_lempiras >= 0),
  cash_given_lempiras numeric(12,2) not null default 0,
  change_lempiras numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.detalle_venta (
  id text primary key,
  sale_id text not null references public.ventas(id) on delete cascade,
  product_id text,
  name text not null,
  qty integer not null check (qty > 0),
  price_lempiras numeric(12,2) not null check (price_lempiras >= 0),
  subtotal_lempiras numeric(12,2) not null check (subtotal_lempiras >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_touch_updated_at
before update on public.products
for each row
execute function public.touch_updated_at();

create policy "Productos visibles para todos"
on public.products
for select
using (true);

create policy "Productos editables por anon"
on public.products
for insert
with check (true);

create policy "Actualizar productos por anon"
on public.products
for update
using (true)
with check (true);

create policy "Eliminar productos por anon"
on public.products
for delete
using (true);

create policy "Ventas visibles para todos"
on public.ventas
for select
using (true);

create policy "Ventas insertables por anon"
on public.ventas
for insert
with check (true);

create policy "Detalle visible para todos"
on public.detalle_venta
for select
using (true);

create policy "Detalle insertable por anon"
on public.detalle_venta
for insert
with check (true);
```

Luego crea un bucket en **Storage** llamado `product-photos` y activa **Public bucket**. Esto permite que las fotos de productos queden disponibles públicamente.

## 5) Instalar dependencias y arrancar la app

```bash
npm install
npm run dev
```

## 6) Cómo instalar la PWA en tablet Android

1. En la misma red Wi‑Fi, abre la URL local mostrada por Vite, por ejemplo `http://192.168.1.20:5173`.
2. En Chrome, toca los tres puntos → **Agregar a la pantalla de inicio** o **Instalar aplicación**.
3. La app queda como acceso directo y se puede usar sin internet tras la primera carga.
4. La PWA se sirve con `manifest.json` y `service worker` para funcionar offline.

## 7) Datos y privacidad

- Todo vive en Supabase en la nube.
- Las fotos se guardan en Supabase Storage, ya comprimidas antes de subirlas desde la tablet.
- Los montos se muestran siempre en Lempiras: `L. 25.00`.
- El respaldo JSON sigue disponible para exportar/importar datos manualmente.

## Stack

- React + Vite + Tailwind CSS
- Supabase JS SDK
- Supabase Storage
- Supabase Postgres
- Manifest + service worker (`public/sw.js`)

## Variables de entorno seguras

- Usa `.env` local, nunca lo subas a GitHub.
- Si usas Git, agrega `.env` a `.gitignore`.
- Nunca pegues la URL ni la anon key directamente en el código fuente.
- En producción, usa variables del entorno del host o del servicio de despliegue.
