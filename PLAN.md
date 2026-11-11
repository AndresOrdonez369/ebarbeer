# Plan — sistema de administración para Bar Beer

Versión 2 · 10 de noviembre de 2026. Planificación; nada de código todavía. Verdad de producto en [PRODUCT.md](PRODUCT.md).
Los datos de ejemplo (nombres, precios, porcentajes, teléfonos) son inventados para ilustrar.

Cambios frente a la versión 1: la caja arma una **cuenta por cliente** con varios ítems; el cliente recibe su **boleta por WhatsApp**; aparece el registro de **clientes**; el alcance se organiza en **núcleo + módulos activables** para cubrir todo lo que una barbería puede necesitar sin inflar la primera entrega; la dirección visual se rehace más metalera.

## 1. Qué se construye

Una web app instalable en el celular (PWA) con tres roles:

| Rol | Para qué entra | Frecuencia |
|---|---|---|
| Cajera/o | Armar la cuenta del cliente al pagar, cobrar y enviar la boleta | 20–80 veces al día |
| Barbero | Ver sus cortes y su ganancia de hoy, su progreso a metas, su historial | Varias veces al día |
| Administrador | Ver el negocio en vivo; gestionar equipo, catálogo, porcentajes, bonos, cierres, pagos y clientes | A diario |

## 2. El flujo central: cuenta, cobro, boleta

El cliente termina, va a la caja, y ahí se le hace la cuenta.

1. **Armar la cuenta.** La cajera toca lo que consumió: servicios (cada uno con su barbero), bebidas y productos, con cantidades. El total se suma solo.
2. **Cobrar.** Un paso más con tres cosas:
   - Cliente: teléfono y nombre. Al teclear los últimos dígitos aparece si ya vino antes. Opcional: se puede cobrar sin cliente.
   - Pago: efectivo, transferencia o tarjeta; admite pago mixto. En efectivo, se escribe cuánto entregó y la app dice las vueltas.
   - Botón Cobrar.
3. **Boleta.** Pantalla de confirmación con un botón principal: **Enviar por WhatsApp**.

Corte simple sin extras: barbero → servicio → Cobrar → Cobrar. Cuatro toques, cinco con la boleta.

Si a la cajera la interrumpen, la cuenta a medio armar se guarda en el dispositivo y puede empezar otra; se retoman desde una fila de cuentas en espera.

### La boleta por WhatsApp

**Cómo funciona.** Al tocar Enviar, la app abre el WhatsApp del celular de caja con el chat del cliente y el mensaje ya escrito (enlace `wa.me`). La cajera toca Enviar en WhatsApp. El mensaje sale desde el número del local.

```
*BAR BEER* · Boleta N.º 0147
Mar 10 nov 2026 · 6:42 p. m.

Corte + barba (Kike) — $30.000
Cerveza × 2 — $12.000
Cera mate — $25.000

*Total: $67.000* · Efectivo

Gracias, Andrés. Te atendió Kike.
Tu boleta: https://<dominio>/b/8f3k2x
```

- El enlace abre la boleta en una página pública con la marca del local, sin iniciar sesión. La dirección es imposible de adivinar.
- El texto es una plantilla que el admin puede editar (saludo, despedida, redes del local).
- La app guarda que la boleta se envió y cuándo.

**Lo que este método no hace.** No es automático: requiere un toque en WhatsApp. No confirma entrega ni lectura. Necesita que el celular de caja tenga instalado el WhatsApp del local (sirve WhatsApp Business, que es gratis).

**Por qué no la API oficial ahora.** El envío automático exige verificar el negocio con Meta, un número dedicado, plantillas aprobadas, costo por mensaje y un servicio que mantener. El día que el volumen lo pida (recordatorios masivos, varias sedes) se agrega sin cambiar nada de lo anterior: la boleta y su enlace ya existen.

**Dos avisos.**

- Esto es un **comprobante**, no una factura electrónica. Si el negocio está obligado a facturar electrónicamente, es una integración aparte con un proveedor autorizado; conviene preguntarle a su contador antes de llamar "factura" al mensaje.
- El teléfono del cliente es un dato personal. Se guarda solo nombre y número, se usa para la boleta, y para mensajes de promoción hace falta que el cliente lo acepte (casilla aparte en el cobro). En Colombia aplica la Ley 1581.

## 3. Alcance: núcleo y módulos

Cada módulo se enciende o apaga por local. Así el mismo software le sirve a otra barbería que trabaje distinto.

### Núcleo (primera entrega)

| Área | Incluye |
|---|---|
| Caja | Cuenta multi-ítem, cuentas en espera, cobro con pago mixto y vueltas, anulación con motivo |
| Boleta | WhatsApp con un toque, página pública de la boleta, plantilla editable |
| Clientes | Nombre, teléfono, visitas, último corte, barbero habitual; búsqueda por teléfono en el cobro |
| Comisiones | Porcentaje por servicio con excepción por barbero; porcentaje de productos configurable (0 % por defecto) |
| Barbero | Hoy, historial, metas |
| Bonos | Reglas por periodo y meta; progreso visible |
| Cierre | Efectivo esperado contra contado, diferencia, historial |
| Admin | En vivo, equipo y accesos, catálogo, reportes con CSV, pagos a barberos |

### Módulos (se activan cuando el local los pida)

| Módulo | Qué resuelve | Tamaño |
|---|---|---|
| Descuentos y cortesías | Rebaja o corte gratis con motivo; define si la comisión se calcula sobre el precio lleno o el rebajado | Pequeño |
| Combos y promociones | Corte + cerveza a precio fijo; promoción por horario | Pequeño |
| Inventario | Existencias de bebidas y productos, entradas, aviso de mínimo, costo y margen | Mediano |
| Fidelización | Tarjeta de sellos digital: cada N cortes, uno gratis; se ve en la boleta | Pequeño |
| Volver a traer clientes | Lista de quienes no vienen hace X semanas, con mensaje de WhatsApp listo a un toque | Pequeño |
| Fila de espera | Lista de turnos de quienes llegan sin cita; aviso "ya casi te toca" por WhatsApp | Mediano |
| Citas | Agenda por barbero y enlace público para reservar | Grande |
| Propinas | Propina por servicio, 100 % al barbero, aparte en su resumen | Pequeño |
| Adelantos y gastos | Vales a barberos descontados del pago; gastos del local | Mediano |
| Alquiler de silla | Barbero que paga cuota fija en vez de porcentaje | Pequeño |
| Horarios y asistencia | Turnos, entrada y salida, días libres | Mediano |
| Opinión del cliente | Calificación desde el enlace de la boleta | Pequeño |
| Reportes avanzados | Horas pico, cuenta promedio, clientes que regresan, productos más vendidos | Mediano |
| Varias sedes | Un dueño, varios locales, reporte consolidado | Mediano |
| WhatsApp automático | API oficial: boleta y recordatorios sin tocar | Grande |
| Factura electrónica | Integración con proveedor autorizado | Grande |

Propinas y adelantos/gastos quedaron fuera por decisión tuya; siguen en la lista como módulos apagados.

Recomendación de orden después del núcleo: descuentos y cortesías, inventario, fidelización, volver a traer clientes. Son los que más plata mueven con menos trabajo.

## 4. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **SvelteKit (Svelte 5) en modo SPA estática** | El bundle más liviano de los frameworks maduros: carga rápida en Android de gama media. |
| Instalación | **PWA** (`@vite-pwa/sveltekit`) | Ícono en pantalla de inicio, pantalla completa, interfaz en caché. Sin tiendas de apps. |
| Datos en cliente | **supabase-js + TanStack Query** | Caché, actualización optimista y cola de envíos si se cae el Wi-Fi. |
| Backend | **Supabase**: Postgres + Auth + Realtime + 2 Edge Functions | Sin servidor propio. La lógica de negocio vive en la base de datos. |
| Estilos y animación | **CSS propio con variables**; animaciones en CSS y View Transitions | Sin librería de componentes ni de animación: menos peso y menos que actualizar. |
| Hosting | **Cloudflare Pages** (gratis) | Estáticos en CDN, despliegue desde GitHub. |
| Pruebas | Vitest (comisiones y totales), pruebas SQL de permisos, Playwright en viewport de celular (cuenta → cobro → boleta) | Lo que no puede fallar: plata y permisos. |

Alternativa si prefieres React: Vite + React + TanStack Query, mismo backend.

**Presupuesto de rendimiento:** JavaScript inicial ≤ 80 kB comprimido; dos o tres archivos de fuente autoalojados; sin fotos de fondo en pantallas de trabajo; respuesta visible al cobrar en menos de 100 ms; Lighthouse móvil ≥ 95; animaciones solo con `transform` y `opacity` para sostener 60 cuadros en gama media.

**Costos:** Supabase y Cloudflare Pages gratis, $0 al mes; dominio propio ~12 USD al año (recomendado ahora, porque el enlace de la boleta le llega al cliente). Límites del plan gratuito de Supabase a confirmar al crear el proyecto: 500 MB de base de datos, pausa tras 7 días sin actividad, sin copias automáticas. Con mantenimiento mensual pagado, Supabase Pro (25 USD/mes) quita la pausa y da respaldo diario.

## 5. Modelo de datos

Todo cuelga de `shops`: una segunda barbería es una fila más.

```
shops                 id, name, timezone, currency, day_cutoff, receipt_template, modules (jsonb)
staff                 id, shop_id, user_id?, role (admin|cashier|barber),
                      display_name, short_code, active, hired_on
catalog_items         id, shop_id, kind (service|drink|product), name, price,
                      commission_pct, counts_as_cut, active, sort_order
commission_overrides  staff_id, item_id, commission_pct
customers             id, shop_id, name, phone (E.164), promo_opt_in,
                      created_at                                   ← único por (shop_id, phone)
sales                 id (uuid generado en el celular), shop_id, receipt_no (consecutivo por local),
                      receipt_token, business_date, created_at, cashier_id, customer_id?,
                      subtotal, discount_total, total, status (ok|void),
                      voided_by, voided_at, void_reason, receipt_sent_at
sale_lines            id, sale_id, shop_id, item_id, barber_id?, qty,
                      item_name, unit_price, discount, commission_pct, commission_amount,
                      counts_as_cut                                ← copia congelada al cobrar
payments              id, sale_id, method (cash|transfer|card), amount, cash_received?
bonus_rules           id, shop_id, name, period (day|week|month), metric (cuts|revenue),
                      threshold, reward_type (fixed|pct_extra), reward_value, active
bonus_awards          rule_id, staff_id, period_start, amount
cash_closings         id, shop_id, business_date, closed_by, closed_at,
                      expected_cash, counted_cash, difference, notes
payouts               id, shop_id, staff_id, period_start, period_end,
                      commission_total, bonus_total, paid_at, paid_by
```

Tablas que llegan con sus módulos: `stock_movements` (inventario), `loyalty_cards` (fidelización), `queue_entries` (fila), `appointments` (citas), `tips`, `advances`, `expenses`.

Decisiones que evitan problemas después:

- **Precio y porcentaje se copian a la venta.** Cambiar el catálogo no mueve lo ya cobrado.
- **Las ventas no se editan ni se borran.** Un error se anula con motivo; queda a la vista del admin, y la boleta pública muestra ANULADA.
- **Pagos en tabla aparte.** Así una cuenta se paga mitad efectivo, mitad transferencia, y el cierre de caja cuadra solo el efectivo.
- **`business_date` con hora de corte** (4 a. m. por defecto): lo cobrado a la 1 a. m. es del día anterior.
- **`id` de venta generado en el celular**: un reenvío por mala red no duplica la cuenta.
- **Consecutivo de boleta por local**, asignado por el servidor.
- **Un barbero puede existir sin usuario**; el acceso se le da cuando quiera.
- **Plata en enteros.** Regla de redondeo de comisión por confirmar.
- **Módulos como interruptores** en `shops.modules`: la app muestra u oculta pantallas según lo activo.

### Lógica y permisos, en la base de datos

- **Escrituras solo por funciones**: `register_sale`, `void_sale`, `close_register`, `mark_payout_paid`, `upsert_customer`. El celular manda qué se vendió; el servidor pone precio, porcentaje y consecutivo.
- **Lecturas con seguridad por fila**: el barbero lee sus líneas, sin teléfonos de clientes; la cajera, las ventas del día y los clientes de su local; el admin, todo su local.
- **Tiempo real**: admin y barbero se suscriben a las ventas de su local.
- **Bonos**: progreso calculado al leer; al cerrar el periodo, una tarea programada (`pg_cron`) fija el bono ganado.
- **Edge Function** `create-staff`: dar, cambiar o quitar el acceso de barberos y cajera sin exponer la llave de servicio.
- **Boleta pública** con la función `get_receipt(token)`, abierta solo a ese token: no hace falta una segunda Edge Function. (Cambio respecto a la versión 2 del plan: menos piezas que mantener.)

### Ingreso

- Admin: correo y contraseña.
- Cajera y barberos: usuario corto + PIN de 6 dígitos que crea el admin; sesión abierta por semanas en el dispositivo.

Un PIN de 6 dígitos es una contraseña débil. Ahora la cajera ve teléfonos de clientes, así que para ese rol conviene contraseña normal o PIN más largo; es un cambio de configuración.

## 6. Pantallas

### Cajera — pestañas: Caja · Hoy · Cierre

- **Caja**: fila de barberos con sus cortes del día; catálogo en tres pestañas (Servicios, Bebidas, Productos); la cuenta del cliente con sus líneas y el total; botón Cobrar. Un servicio se asigna al barbero seleccionado; bebidas y productos no piden barbero.
- **Cobro** (paso siguiente, no pestaña): cliente, pago, vueltas, Cobrar.
- **Boleta** (confirmación): Enviar por WhatsApp · Nueva cuenta.
- **Hoy**: cuentas del día, total por barbero y por método de pago; reenviar boleta; anular con motivo.
- **Cierre**: efectivo esperado, contado, diferencia, nota, confirmar.

### Barbero — pestañas: Hoy · Historial · Metas

- **Hoy**: cortes y ganancia de hoy, lista de servicios con hora. Se actualiza solo.
- **Historial**: semana, mes y total; cada día es una fila.
- **Metas**: progreso a cada bono activo y bonos ganados.

Solo lectura. No ve a los demás barberos, ni el total del local, ni teléfonos de clientes.

### Administrador — pestañas: En vivo · Equipo · Catálogo · Reportes · Más

- **En vivo**: total del día, cortes, reparto por método de pago, barberos por cortes, últimas cuentas, estado del cierre.
- **Equipo**: crear barbero o cajera, accesos, restablecer PIN, porcentajes especiales.
- **Catálogo**: servicios, bebidas y productos con precio, porcentaje, orden y activo/inactivo.
- **Reportes**: día, semana, mes; por barbero, por servicio, por producto; CSV.
- **Más**: clientes, bonos, pagos a barberos, cierres, anulaciones, plantilla de la boleta, módulos, datos del local.
- El admin también puede cobrar.

### Estados que hay que diseñar

- Local recién creado: sin barberos ni catálogo; la primera pantalla lleva a crearlos.
- Día sin ventas. Cuenta vacía.
- Sin conexión: la cuenta queda "pendiente de enviar" y sube sola al volver la red; la boleta por WhatsApp espera a que suba.
- Cliente sin WhatsApp o que no quiere dar el número: se cobra igual, sin boleta.
- Teléfono mal escrito: validación de largo y prefijo antes de abrir WhatsApp.
- Cuenta anulada: tachada, con motivo.
- Barbero desactivado: sale de la caja, conserva su historial.
- Caja cerrada. Sesión vencida sin perder la cuenta en curso.

### Rangos reales esperados

| Cosa | Mínimo | Típico | Máximo a soportar bien |
|---|---|---|---|
| Barberos activos | 1 | 4–6 | 12 |
| Servicios | 3 | 6–10 | 20 |
| Bebidas y productos | 0 | 10–25 | 80 |
| Ítems por cuenta | 1 | 1–3 | 15 |
| Cuentas por día | 0 | 20–80 | 200 |
| Clientes guardados | 0 | cientos | 20.000 |

## 7. Dirección visual

### Jarra y cuchilla

Elegida el 10 de noviembre de 2026, en segunda ronda. Boceto de la caja: [r2-assigned.html](.impeccable/mocks/decision/r2-assigned.html) (datos de ejemplo). La primera dirección, Fechas de gira, se descartó por plana, con poca marca y poco metal.

**De dónde sale.** La barra de un bar metalero y el nombre mismo del local: barbería y cerveza. Jarra, ámbar, espuma, madera negra, cromo.

**La idea.** Cada barbero tiene una jarra que se va llenando con sus cortes hasta la meta. El progreso del día se ve de un vistazo, sin leer un número.

**Lo que rechaza.** El panel oscuro de fichas grises con un acento neón, y también el disfraz metalero de calaveras y llamas.

| Elemento | Decisión |
|---|---|
| Fondo | Negro tostado `#0C0906` con vetas de tablón apenas visibles. Paneles en madera oscura `#1A120B`, filetes `#3A2A1C`. |
| Texto y cifras | Espuma `#F7ECD2`. Secundario en `#A8977F`. |
| Ámbar `#F2A20C` | Progreso y dinero: la cerveza de las jarras, el conteo de cortes, la pestaña activa, el filo superior de la cuenta. |
| Rojo `#D8121F` | Cobrar, anular, alertas, sello META. |
| Azul `#2A4FB5` | Selección: barbero y servicio elegidos. Siempre como relleno con texto claro encima. |
| Cromo `#E8EAED` | Contorno de las jarras y de la placa. |
| Tipografía | Big Shoulders Display en mayúsculas para cifras y acciones; Chakra Petch para nombres, etiquetas y texto, por su corte angular cercano al de la placa del logo. |
| Forma | Esquinas de 4 px, filetes de 1 px, botón de cobrar con canto inferior marcado. Botones de 48 px o más. |
| Marca | Placa BAR BEER tricolor con la jarra, arriba a la izquierda en todas las pantallas. Logo completo de la E en el ingreso y en el ícono de la app. |

**Gesto propio.** La jarra. Vive donde haya progreso hacia una meta: fila de barberos en la caja, pantalla Hoy y Metas del barbero, vista en vivo del admin. En lo demás (catálogo, formularios, reportes) no aparece: ahí manda la lectura.

**Mejoras tomadas de las direcciones descartadas:**

- Solo se mueve lo que cambió: el contador que sube es el único que anima.
- Una decisión a la vez: la pantalla muestra el paso que sigue.
- De la cuenta al cobro en un gesto, sin pantalla de carga.
- Cambios secos: nada flota ni se desvanece más de 150 ms.
- Cada cifra cae en su columna, alineada como en imprenta.

**Riesgos conocidos.**

- La jarra puede leerse simpática antes que metalera. Respuesta: todo lo demás aprieta (tipografía pesada, negro, cromo, rojo), y la jarra se dibuja sobria, sin caricatura.
- Con más de 6 barberos las jarras no caben en una fila. Respuesta: dos filas hasta 12; más allá, lista con barra de llenado.
- Un barbero sin meta configurada no tiene hasta dónde llenar. Respuesta: jarra sin marca de meta, solo el conteo.
- Burbujas animadas todo el tiempo gastan batería. Respuesta: animan al cargar y al cambiar el conteo, luego quedan quietas.

**Lo que el boceto no cubre.** Solo la primera pantalla de la caja a 390 × 844. Faltan el paso de cobro, la boleta, las demás pantallas, los estados y el comportamiento en otros tamaños.

Al construir, esta dirección se convierte en tokens CSS, y el sistema de diseño (DESIGN.md) se documenta al final, a partir de lo construido.

Reglas de uso:

- Oscuro, por la escena real: local con poca luz, madera oscura, pantalla en la mano.
- Navegación y controles conocidos: pestañas abajo, botones grandes, listas. El mundo metalero entra por tipografía, paleta, densidad y un gesto propio, no cambiando cómo se usa.
- Botones de al menos 48 px, lo frecuente al alcance del pulgar.
- Estado por forma además de color: anulada tachada, pendiente punteada.

### Animación

Cada animación avisa de algo que pasó. Ninguna hace esperar.

| Momento | Qué se mueve | Duración |
|---|---|---|
| Se agrega un ítem a la cuenta | La línea entra y el total cambia de cifra | 150 ms |
| Se cobra un servicio | La jarra del barbero sube un nivel y la espuma se asienta | 400–500 ms, una vez |
| Un barbero cruza la meta | La espuma rebosa y cae el sello META | 450 ms |
| Se abre la app | Las jarras se sirven hasta su nivel | 900 ms, una vez |
| Llega una venta en vivo (admin, barbero) | Solo el contador que cambió | 200 ms |
| Cambio de pestaña o paso | Transición de vista | 150 ms |
| Carga | Esqueletos del contenido, sin ruedas | — |

En Android, vibración corta al cobrar. Con "reducir movimiento" activado en el sistema, todo cambia sin animación.

## 8. Fases

### Estado de la fase 1 (10 de noviembre de 2026)

Hecho: esquema completo del núcleo, permisos por rol, funciones de dinero (`register_sale`, `void_sale`, `close_register`, `upsert_customer`, `get_receipt`, `day_board`, `day_totals`), 33 pruebas de base de datos en verde, Edge Function `create-staff`, app SvelteKit 3 con ingreso por rol, modo demostración, tokens visuales, placa, jarra animada, pantallas base de los tres roles y PWA instalable.

Diferencias con lo planeado:

- SvelteKit salió en versión 3 (sin `$lib`, configuración dentro de `vite.config.ts`). Se usa esa.
- TanStack Query queda para la fase 2, donde de verdad hace falta (cobro optimista y cola sin conexión).
- JavaScript inicial: **102 kB** comprimido, por encima de la meta de 80 kB. Supabase-js solo pesa 58 kB. Resuelto en la fase 7 (ver abajo).
- Sin probar contra un proyecto Supabase real (no hay uno todavía): la Edge Function y el ingreso real están escritos pero no ejecutados.

### Estado de la fase 2 (10 de noviembre de 2026)

Hecho:

- **Cuenta y cobro.** Cuenta de varios ítems y paso de cobro: efectivo con montos rápidos y vueltas, transferencia, tarjeta o pago mixto con botón "Resto".
- **Pantalla de cobrada.** Muestra el número de boleta y las vueltas, y la jarra del barbero sube en ese momento.
- **Cuentas en espera.**
- **Cola sin conexión.** La cuenta se guarda en el celular, la jarra la cuenta de inmediato y se envía sola al volver la red, sin riesgo de cobrar dos veces.
- **Pestaña Hoy.** Totales por método y por barbero, lista de cuentas con estados por forma (anulada tachada, por enviar punteada, rechazada en rojo) y anulación con motivo.
- **Tiempo real**, ya conectado desde la fase 1.

Pruebas:

- 20 comprobaciones de punta a punta en Edge sin ventana (`node scripts/e2e-caja.mjs`).
- 7 pruebas de la lógica de dinero (`npm run test:unit`).

Cambio frente al plan: en vez de TanStack Query, una cola propia de unas 100 líneas (`src/lib/outbox.svelte.ts`). Hace lo único que se necesitaba (guardar, reintentar, no duplicar) sin otra dependencia.

Pendiente fuera de la fase: el modo demostración pierde los cobros al recargar la página; es solo para mostrar.

### Estado de la fase 3 (11 de noviembre de 2026)

Hecho:

- **Cliente en el cobro.** WhatsApp con búsqueda por dígitos de clientes que ya vinieron, nombre opcional y casilla de promociones. Sin número se cobra igual. Un número incompleto o inválido bloquea el cobro y dice por qué.
- **Cliente dentro de la cuenta.** Viaja con la cuenta (`register_sale` acepta `p_customer`), así que una cuenta cobrada sin internet conserva su cliente al enviarse.
- **Boleta por WhatsApp con un toque.** El botón abre el WhatsApp del celular de caja con el chat y el mensaje ya escritos; la cajera toca Enviar allá. Se puede reenviar desde Hoy, y también agregar el número después de cobrar.
- **Página pública de la boleta** (`/b/<token>`): sin cuenta, nunca muestra el teléfono, sello ANULADA si se anuló y la aclaración "No es una factura electrónica".
- **Plantilla editable** por el administrador (Más → Plantilla de la boleta), con datos insertables y vista previa.
- **El modo demostración guarda su estado en la pestaña**: ya no pierde los cobros al recargar.

Pruebas:

- 38 de base de datos.
- 14 unitarias: dinero, mensaje, teléfono y enlace.
- 36 comprobaciones de punta a punta.

### Estado de la fase 4 (12 de noviembre de 2026)

Hecho:

- **Hoy del barbero.** Jarra grande, cortes y ganado del día, y la lista de sus servicios con hora, lo que le deja cada uno (y de cuánto) y "+1 a la jarra" en los que cuentan como corte. Los anulados aparecen tachados.
- **Historial.** Semana, mes y todo. Cada día es una fila con una barra de nivel (su jarra del día). Todo se agrupa por mes, con "desde" y promedio de cortes por día.
- **Metas.** La jarra de hoy y cada bono activo con su periodo, "vas X de Y", barra de nivel, premio y lo que falta, más los bonos ganados.
- **Funciones SQL** `my_day_lines`, `my_history`, `my_totals` y `my_goals`. Las semanas empiezan el lunes. Todas filtran por el propio barbero.

Pruebas:

- 44 de base de datos.
- 17 de punta a punta del barbero.
- Las 39 de caja siguen en verde.

Pendiente fuera de la fase: crear las reglas de bono es de la fase 6. Hasta entonces Metas muestra su estado vacío, salvo en la demostración, que trae dos reglas de ejemplo.

### Estado de la fase 5 (13 de noviembre de 2026)

Hecho:

- **Equipo.** Crear personas, editar sus datos (rol, si atiende clientes, meta diaria propia, ingreso, activo), dar acceso con usuario y PIN, cambiar el PIN, quitar el acceso y fijar porcentajes especiales por servicio.
- **Catálogo.** Agregar, cambiar precio y comisión, marcar si cuenta como corte, ocultar de la caja y ordenar dentro de cada pestaña.
- **Clientes.** Lista con visitas, última visita y gasto, más búsqueda por nombre o número. Solo la ve el administrador.
- **Datos del local.** Nombre, meta diaria de cortes y hora de cierre del día.
- **Vocabulario de formularios compartido** en `src/app.css`.

Pruebas:

- 52 de base de datos.
- 20 de punta a punta de administración, que verifican cada cambio donde importa: la caja y las jarras.
- Las de caja (39) y barbero (21) siguen en verde.

Sin probar contra Supabase real: dar acceso pasa por la Edge Function `create-staff`, que todavía no se ha desplegado.

### Estado de la fase 6 (11 de noviembre de 2026)

Hecho:

- **Cierre de caja** (Caja → Cierre). Muestra cuánto efectivo debería haber, la cajera escribe lo contado y ve al momento si cuadra, falta o sobra; nota opcional y confirmación antes de cerrar, porque no se puede cambiar. Si ayer quedó sin cierre, lo avisa y deja cerrarlo primero. No deja cerrar mientras haya cuentas por enviar en el celular.
- **Historial de cierres.** Por mes: cada día con lo contado frente a lo esperado, quién cerró, la diferencia y la nota; arriba, cuántos no cuadraron y la diferencia neta.
- **Bonos.** Crear, cambiar y pausar reglas (por día, semana o mes; por cortes o ventas; premio fijo o porcentaje extra sobre la comisión). Los premios se calculan solos cada noche con `pg_cron` (`award_bonuses_all`), o al momento con "Calcular bonos pendientes". Cada periodo cerrado se premia una sola vez.
- **Pagos a barberos.** Por semana o mes: comisión más bonos de cada uno y el total por pagar. "Marcar pagado" pide confirmación y guarda los montos que calcula el servidor, no los del celular. Un periodo que sigue corriendo no se puede marcar.
- **Reportes.** Día, semana o mes: vendido, cuentas, promedio, anuladas, métodos de pago, cortes, comisiones, y desgloses por barbero, por servicio, bebida y producto, y por día. **CSV** con todas las líneas del periodo, separado por punto y coma y con BOM para que Excel en español lo abra bien.
- **Anulaciones.** Cada cuenta anulada con su motivo, quién la anuló y a qué hora.
- **Funciones SQL** `award_bonuses`, `payout_summary`, `mark_payout_paid`, `report_summary`, `report_lines`, `voided_sales`, `closing_history` y `my_expected_cash` (el efectivo esperado solo del propio local).

Pruebas:

- 64 de base de datos.
- 16 unitarias (se suma el CSV).
- 54 de punta a punta de la plata (`node scripts/e2e-dinero.mjs`), incluida la descarga real del CSV.
- Las de caja (39), barbero (21) y administración (32) siguen en verde.

Sin probar contra Supabase real: el cálculo nocturno necesita la extensión `pg_cron` activada en el proyecto (Database → Extensions) antes de aplicar la migración; sin ella, los bonos se calculan con el botón.

### Estado de la fase 7 (11 de noviembre de 2026)

Hecho:

- **Rendimiento.** El acceso a datos (Supabase o la demostración) se carga en un archivo aparte. Sin sesión guardada, la pantalla de ingreso no lo espera. Medido en 4G emulado (`node scripts/measure.mjs` contra `npm run preview`):

  | Pantalla | Antes | Ahora |
  |---|---|---|
  | Ingreso, modo real | 108 kB | **40,6 kB** antes de mostrarse (Supabase llega después, en paralelo) |
  | Caja, demostración | 122 kB | 65 kB |
  | Barbero y admin, demostración | 112 kB | 55 kB |

  Con la app instalada, todo queda en caché del celular y las visitas siguientes no descargan nada.
- **Sin conexión.** Aviso discontinuo bajo la cabecera en todas las pantallas ("lo que ves puede estar atrasado"); las cifras se quedan y se ponen al día solas al volver la red. En la caja manda el aviso de cuentas por enviar.
- **Sesión vencida o acceso quitado.** Vuelve al ingreso con una nota; la cuenta en curso, las cuentas en espera y lo pendiente por enviar siguen en el celular. Un error de sesión ya no marca como rechazada una cuenta en cola: espera a que se vuelva a entrar.
- **La cuenta en curso sobrevive** a recargar, cerrar la app o un fallo; si un ítem dejó de venderse, se quita al recuperarla. Una cuenta ya cobrada nunca vuelve a aparecer abierta, aunque la página se recargue a mitad del cobro (evita cobrarla dos veces).
- **Abrir la app sin conexión.** Con la última sesión, el perfil y el catálogo guardados en el celular, la caja abre y cobra a la cola aunque no haya red. "Salir" sin conexión borra la sesión del celular de todos modos (importante en el celular compartido de caja).
- **Caja ya cerrada.** La caja avisa que el efectivo cobrado después queda fuera del cierre del día.
- **Local recién creado.** "Primeros pasos" en En vivo: barberos, catálogo, accesos y meta, con el siguiente paso marcado y lo hecho chuleado.
- **Página de error** propia, sin perder lo cobrado.
- **Accesibilidad.** Revisión automática con axe-core (WCAG 2.1 A y AA) de 24 pantallas y estados de los tres roles: cero problemas (`node scripts/a11y.mjs`).
- **Respaldo automático y anti-pausa.** `.github/workflows/respaldo.yml`: lunes y jueves exporta roles, esquema y datos (falla si el respaldo sale sin ventas o sin usuarios), hace una consulta para que el proyecto gratuito no se pause y guarda el respaldo 90 días.

Pruebas:

- 64 de base de datos y 16 unitarias.
- 17 de punta a punta de lo nuevo (`node scripts/e2e-endurecer.mjs`).
- Caja (39), barbero (21), administración (32) y plata (54) siguen en verde.

### Conexión a Supabase real (11 de noviembre de 2026)

Proyecto `ibjmbvzxrfakfixrvvxj`: migraciones aplicadas, local "Bar Beer" creado, `pg_cron` activo (la migración lo enciende sola) con el cálculo nocturno programado, `create-staff` desplegada y registro público apagado. Probado por el dueño: ingreso de administrador, crear barbero y cajera con acceso, cobro desde la caja y tiempo real en la vista del barbero.

Encontrado y corregido al conectar:

- Crear persona fallaba: el permiso de insertar en `staff` no incluía `active` (migración `20261115000002`). Las pruebas de base ahora escriben exactamente lo que escribe la app.
- El revisor de seguridad de Supabase pidió cerrar funciones ejecutables sin sesión, fijar `search_path` en cuatro funciones y evaluar `auth.uid()` una vez por consulta (migración `20261115000001`).
- Los errores de permisos de Postgres salían en inglés; ahora la app los dice en español.

### Pagar a los barberos en la caja (11 de noviembre de 2026)

El flujo del local: cada barbero atiende, la cajera cobra cada cuenta, y al terminar la jornada el barbero pasa por la caja a preguntar cuánto le toca.

- **Caja → Barberos.** Lista de los barberos con sus cortes de hoy y lo que le toca a cada uno ("Por pagar hoy" arriba). Tocar uno abre su liquidación.
- **Liquidación de un barbero** (día, semana o mes): "Le toca" en grande, cómo se arma (comisión + bonos − ya pagado), cortes, servicios y lo que vendió, lo que hizo servicio por servicio con lo que le deja cada uno, sus bonos y los pagos ya hechos. Si le quedó algo de días anteriores, lo avisa y lleva a la semana.
- **Pagar con un botón.** Efectivo o transferencia, confirmación ("¿Le entregaste $ 71.000 a Kike en efectivo? Sale del cajón…") y comprobante con el resumen listo para mandarle por WhatsApp.
- **Nada se paga dos veces.** Cada comisión y cada bono queda marcado con el pago que lo cubrió; si después se cobra otro corte, solo ese queda pendiente. Una cuenta cuya comisión ya se pagó no se puede anular.
- **Bonos del día** ("5 cortes en el día") se pagan esa misma noche si se cumplieron.
- **El cierre de caja descuenta** lo pagado a barberos en efectivo ("Cobrado en efectivo − pagado a barberos").
- **El barbero ve** en su pantalla "Por cobrar en caja" o "Ya te pagaron hoy".
- **Administración → Pagos** usa la misma liquidación, por día, semana o mes, y también puede pagar.

- **Lo pendiente de antes nunca se pierde.** Si quedó algo sin pagar (un domingo, un bono semanal), cada vista lo avisa con la fecha, la lista de Barberos lo muestra por barbero y "Ver todo lo pendiente" junta todo hasta hoy para pagarlo de una vez. El barbero también lo ve.
- **Lo que se confirma es lo que se paga.** El servidor recibe el monto que la cajera confirmó; si algo cambió entre medio (otra venta, otro celular pagó), no registra nada y pide confirmar el monto nuevo.
- **Con la caja de hoy ya cerrada** no se puede pagar en efectivo (el dinero saldría del cajón sin registro); se paga por transferencia.
- Los bonos diarios por porcentaje se calculan al cerrar el día, para no congelarlos antes de tiempo.

Una revisión independiente encontró carreras entre pagar y cobrar o anular al mismo tiempo, la lista de la cajera mostrando bonos en cero y los puntos de arriba; todo quedó corregido antes de aplicarlo en Supabase.

Pruebas: 68 de base de datos y 25 de punta a punta nuevas (`node scripts/e2e-liquidar.mjs`). Migración `20261116000001_settle.sql` aplicada en el proyecto real.

Falta:

- Subir el código a un repositorio privado de GitHub y cargar los secretos del respaldo; correr el primer respaldo a mano.
- Publicar la app (Vercel ya configurado en `vercel.json`; ver README sobre el plan comercial) con las variables `VITE_*`.
- La semana de piloto en el local, cuadrando contra el cuaderno.
- Opcional en el panel de Supabase: protección contra contraseñas filtradas (Authentication → Passwords).

| Fase | Entrega | Se puede probar |
|---|---|---|
| 0. Datos reales | Servicios, bebidas, productos, precios, porcentajes, bonos, barberos; logo en vectorial; proyecto Supabase, repositorio y dominio | — |
| 1. Cimientos | Esquema, permisos, funciones y datos de ejemplo; app base con ingreso por rol, tokens visuales y PWA instalable | Entrar con cada rol |
| 2. Caja | Cuenta multi-ítem, cobro con pago mixto y vueltas, anulación, pestaña Hoy, tiempo real | La cajera cobra en paralelo al cuaderno |
| 3. Boleta y clientes | Registro de cliente en el cobro, envío por WhatsApp, página pública de la boleta, plantilla | Un cliente recibe su boleta |
| 4. Barbero | Hoy, Historial, Metas | Cada barbero ve sus números |
| 5. Admin | En vivo, Equipo, Catálogo, porcentajes especiales, Clientes | El dueño configura todo sin ayuda |
| 6. Plata | Cierre de caja, bonos, pagos a barberos, reportes y CSV | Un cierre de semana completo |
| 7. Endurecer | Sin conexión, estados vacíos y de error, accesibilidad, rendimiento, respaldo automático | Una semana de piloto; se entrega al cuadrar con el cuaderno |
| Después | Módulos, uno por uno, en el orden recomendado de la sección 3 | — |

Las fases 2 y 3 juntas son la demostración para el cliente.

## 9. Mantenimiento

- **Respaldo**: tarea semanal en GitHub Actions que exporta la base a un archivo privado.
- **Anti-pausa**: la misma tarea hace una consulta para que el proyecto gratuito no se pause.
- **Actualizaciones**: dependencias mínimas; revisión cada 3–4 meses.
- **Monitoreo**: errores del cliente a una tabla `client_errors`.
- **Propiedad**: Supabase, hosting y dominio a tu nombre, no del cliente.

## 10. Decisiones que faltan

1. Meta diaria de cortes por barbero, que es hasta donde se llena la jarra (¿igual para todos o por barbero?).
2. Nombre exacto en la app y logo en buena resolución.
3. Lista real de servicios, bebidas, productos, precios y porcentajes.
4. ¿Bebidas y productos dan comisión? ¿A quién?
5. Reglas de bono: periodo, meta, monto fijo o porcentaje extra.
6. ¿Qué servicios cuentan como "corte" para contador y bonos?
7. Métodos de pago reales (supuesto: efectivo, transferencia/Nequi, tarjeta).
8. Redondeo de comisiones.
9. ¿La cajera puede anular sola o necesita al admin?
10. ¿El celular de caja es del local y tiene el WhatsApp del local?
11. ¿El negocio está obligado a factura electrónica? (preguntar al contador)
12. Cada cuánto se les paga a los barberos.
13. Dominio para la app y los enlaces de boleta.
