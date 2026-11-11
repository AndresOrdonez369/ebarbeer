# Bar Beer

Web app (PWA) para la caja, los barberos y la administración de Bar Beer. Plan completo en [PLAN.md](PLAN.md); verdad de producto en [PRODUCT.md](PRODUCT.md).

Estado: **fase 7 — endurecida, lista para el piloto**. Caja completa con boleta por WhatsApp y cierre de caja, vista del barbero (servicios, historial, metas) y administración: equipo con accesos y porcentajes especiales, catálogo editable, clientes, datos del local, bonos, pagos a barberos, reportes con CSV, historial de cierres y anulaciones.

## Probar ya, sin Supabase

```bash
npm install
npm run dev:demo
```

`dev:demo` arranca el **modo demostración**: datos de ejemplo en memoria, tres botones para entrar como Caja, Barbero o Administración. Solo existe en desarrollo y en las pruebas automáticas: la app publicada nunca muestra datos de ejemplo. Si le faltan las variables de Supabase, dice "Falta conectar la base de datos".

## Conectar Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito). Región sugerida: São Paulo.
2. **Authentication → Sign In / Providers → Email**: desactiva *Allow new users to sign up*. Solo el administrador crea cuentas.
3. Aplica las migraciones. Con la CLI:
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref <ref-del-proyecto>
   ```
   ```bash
   npx supabase db push
   ```
   Sin CLI: pega en el **SQL Editor**, en orden, los archivos de `supabase/migrations/`.
4. Crea tu usuario administrador en **Authentication → Users → Add user** (correo y contraseña, marcado como confirmado).
5. En el **SQL Editor**:
   ```sql
   select public.bootstrap_shop('bar-beer', 'Bar Beer', 'tu-correo@ejemplo.com', 'Tu nombre');
   ```
   Opcional, catálogo y equipo de ejemplo: pega `supabase/seed.sql`.
6. Despliega la función para dar accesos a barberos y cajera:
   ```bash
   npx supabase secrets set STAFF_EMAIL_DOMAIN=staff.barbeer.app
   ```
   ```bash
   npx supabase functions deploy create-staff
   ```
7. Copia `.env.example` a `.env` y pon la URL y la *anon key* (Project Settings → API).
8. `npm run dev` y entra con tu correo.

Los accesos de barberos y cajera se dan desde Administración → Equipo → la persona → Acceso (usa la función `create-staff`, que debe estar desplegada).

## Pruebas

Las pruebas de punta a punta usan la demostración. Con `.env` apuntando al proyecto real, levanta el servidor así:

```bash
npm run dev:demo
```

```bash
npm run test:db
```

Corre todas las migraciones en un Postgres en memoria (PGlite) que imita a Supabase, y prueba cobros, comisiones, anulaciones, cierre, boleta pública y permisos por rol. No necesita Docker ni cuenta.

```bash
npm run test:unit
```

Lógica de dinero de la caja (vueltas, pago mixto, montos rápidos), de la boleta (mensaje, teléfono, enlace de WhatsApp) y del CSV.

```bash
node scripts/e2e-caja.mjs
```

Recorre la caja en el modo demostración a tamaño de celular con Edge sin ventana: cobro con vueltas, pago mixto, cuentas en espera, sin conexión, anulación, cliente y boleta por WhatsApp, boleta pública y plantilla. Necesita `npm run dev:demo` corriendo. Deja capturas en `.impeccable/review/p2-*.png`.

```bash
node scripts/e2e-barbero.mjs
```

Recorre las pantallas del barbero: servicios de hoy con hora y comisión, historial por semana, mes y todo, metas y bonos.

```bash
node scripts/e2e-admin.mjs
```

Recorre la administración y verifica cada cambio en la caja: crear barbero con acceso y porcentaje especial, catálogo (agregar, precio, ocultar, orden), clientes, meta del local y protecciones.

```bash
node scripts/e2e-dinero.mjs
```

Recorre la plata: cierre de caja con faltante, historial de cierres, reportes (y que el del día cuadre con la caja), descarga del CSV, bonos (crear, validar, pausar y que el barbero lo vea), pagos a barberos y anulaciones.

```bash
node scripts/e2e-endurecer.mjs
```

Estados difíciles: sin conexión, la cuenta en curso tras recargar, caja ya cerrada y local recién creado.

```bash
node scripts/a11y.mjs
```

Accesibilidad con axe-core (WCAG 2.1 A y AA) en todas las pantallas de los tres roles.

```bash
npm run build
```
```bash
npm run preview
```
```bash
node scripts/measure.mjs
```

Cuánto JavaScript descarga cada pantalla en 4G emulado.

```bash
npm run check
```

## Respaldo automático

`.github/workflows/respaldo.yml` corre lunes y jueves en GitHub Actions: exporta roles, esquema y datos de la base y hace una consulta para que el proyecto gratuito no se pause. Cada respaldo queda 90 días en la pestaña **Actions → Respaldo → Artifacts**.

1. Sube el proyecto a un repositorio **privado** de GitHub (el respaldo trae teléfonos de clientes).
2. En **Settings → Secrets and variables → Actions** crea `SUPABASE_DB_URL` (Project Settings → Database → Connection string, *Session pooler*, con la contraseña), `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
3. Córrelo una vez a mano (**Actions → Respaldo → Run workflow**) y revisa que termine en verde.

Restaurar en un proyecto nuevo, con los tres archivos del respaldo descargados:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file esquema.sql --command 'SET session_replication_role = replica' --file datos.sql --dbname "<cadena de conexión del proyecto nuevo>"
```

## Despliegue

Es una app estática (SPA): cualquier hosting de archivos sirve. Las variables son las mismas del `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SHOP_SLUG` y `VITE_STAFF_EMAIL_DOMAIN`.

**Vercel** (ya configurado en `vercel.json`):

1. Sube el código a GitHub (repositorio privado).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio. Vercel lee `vercel.json`: comando `npm run build`, carpeta `build`, y cualquier ruta abre la app (también los enlaces de boleta `/b/...`).
3. En **Environment Variables** pon las cuatro variables `VITE_*` y despliega.
4. Cada `git push` publica solo.

Ojo con el plan: el plan gratuito de Vercel (Hobby) es solo para uso personal, no comercial. Si la app se vende o la usa un negocio, corresponde el plan Pro. **Cloudflare Pages** permite uso comercial gratis: comando `npm run build`, carpeta `build`, las mismas variables.

## Estructura

```
src/app.css                 tokens visuales (colores, tipos, movimiento)
src/lib/components/         Plate (placa BAR BEER), Mug (la jarra), Lineup, AppHeader, TabBar
src/lib/backend-live.ts     Supabase
src/lib/backend-demo.ts     datos de ejemplo
src/routes/                 ingreso, caja, barbero, admin
supabase/migrations/        esquema, permisos, funciones, tiempo real
supabase/functions/         create-staff
supabase/tests/run.mjs      pruebas de base de datos
scripts/icons.mjs           íconos y arte del ingreso desde brand-source/
brand-source/               logo enviado por el cliente (reemplazar por el vectorial)
```
