# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: el usuario pidió que se elija el stack con mejor rendimiento móvil y bajo mantenimiento, con Supabase (plan gratuito) como base de datos. Elección registrada en PLAN.md.

## Users

Tres roles dentro de una barbería-bar de estética metalera:

- **Cajera/o** — usuario principal en frecuencia. De pie en la caja, celular en mano, cobrando mientras hay música y clientes esperando. Registra cada corte o producto en el momento en que recibe el dinero y lo asigna al barbero que lo hizo.
- **Barbero** — consulta entre clientes, en su propio celular: cuántos cortes lleva hoy, cuánto ha ganado, su historial.
- **Administrador** — dueño o encargado. Mira el negocio en tiempo real desde el celular (a veces fuera del local), gestiona barberos, accesos, servicios, productos, porcentajes y bonos.

## Product Purpose

Reemplazar el cuaderno o la memoria: cada corte y cada venta queda registrado al cobrarse, asignado a un barbero, y de ahí salen solos los totales de cada quien (diario sobre todo, también semanal y mensual) con su comisión. Éxito: al cerrar el día nadie discute cuántos cortes hizo ni cuánto le toca, y el administrador sabe cómo va el negocio sin preguntar.

## Positioning

Software hecho a la medida de esta barbería y con su identidad, no un POS genérico: registrar un corte toma dos toques, y la comisión de cada barbero se calcula sola con sus propias reglas.

## Operating Context

- Un solo local hoy. La base de datos separa cada negocio para poder vender el mismo software a otra barbería sin rehacerlo.
- El desarrollador (usuario) vende y mantiene el software; quiere poco mantenimiento y costo de infraestructura cercano a cero.
- Uso casi exclusivo en celular, en navegador. No es app nativa.
- El local vende servicios de barbería (corte, cejas, barba…) y productos (cerveza, cera, piercings…).

## Capabilities and Constraints

Confirmado:

- Tres roles: administrador, cajero, barbero. El administrador crea barberos y da acceso a cajeros.
- El administrador gestiona el catálogo: servicios y productos, con precio y porcentaje de comisión.
- Comisión: porcentaje por servicio, con excepción opcional por barbero (un barbero puede tener un porcentaje distinto en un servicio).
- La cuenta se hace al final, cuando el cliente va a pagar: la cajera suma servicios (cada uno asignado a su barbero), bebidas y productos, y sale el total.
- Cada cuenta registra método de pago.
- El cliente recibe su comprobante por WhatsApp: mensaje con los datos de su cuenta, enviado desde el WhatsApp del celular de caja (número del local) con un toque.
- Para eso se guarda nombre y teléfono del cliente.
- El alcance se organiza en núcleo más módulos activables por local (inventario, descuentos, fidelización, fila, citas, entre otros); lista en PLAN.md.
- Cierre de caja diario: la cajera cuenta el efectivo y el sistema lo compara con lo esperado; el administrador ve diferencias.
- Resúmenes por barbero: diario (principal), semanal, mensual — cantidad de cortes y ganancia.
- El barbero ve solo lo suyo, incluido su historial desde que empezó.
- Bonos por metas (ejemplo dado: más de 20 cortes), configurables por el administrador.
- Vista general del negocio en tiempo real para el administrador.

Fuera de la primera entrega por decisión del usuario: propinas, adelantos a barberos, gastos del local (quedan como módulos apagados).

Sin decidir:

- Nombre exacto del negocio (logo: "E" + "BAR BEER").
- Moneda y métodos de pago concretos (supuesto: pesos colombianos; efectivo, transferencia/Nequi, tarjeta).
- Si los productos generan comisión y para quién.
- Reglas exactas de bonos (periodo, monto, si es por cortes o por ingresos).
- Dispositivo de caja (celular propio de la cajera o uno del local) y método de ingreso.
- Si se necesita funcionar con mala conexión.
- Control de inventario de productos.

## Brand Commitments

- Logo existente: "E" biselada en blanco cromado con silueta de barba, y placa "BAR BEER" en forma de cuchilla con tres franjas negro / rojo / azul. Fondo de madera oscura.
- Estética metalera / glam metal, oscura. El usuario la declaró obligatoria para toda la web.
- Tras ver una primera propuesta pidió: más metal clásico, más presencia de marca, más acabado, más claridad, colores interesantes y animaciones, con alusión a que es una barbería llamada Bar Beer.

## Evidence on Hand

- Logo como imagen (recibido en la conversación; falta el archivo original en buena resolución, idealmente SVG o PNG con transparencia).
- No hay todavía: lista real de servicios y precios, lista de productos, nombres de barberos, porcentajes reales, reglas de bonos. No inventar como reales; usar datos de ejemplo marcados como tales.

## Product Principles

1. **La caja manda.** El registro de una venta es el flujo más frecuente y debe ser el más corto del sistema.
2. **Una venta registrada no se reescribe.** El porcentaje y el precio quedan congelados en el momento del cobro; las correcciones son anulaciones visibles, no ediciones silenciosas.
3. **Cada quien ve lo suyo.** Barbero: sus números. Cajera: el día. Admin: todo.
4. **Hoy primero.** El día actual es la vista por defecto en todos los roles; semana y mes son un paso más.
5. **Cero mantenimiento como requisito.** Nada que exija servidores propios, tareas manuales o costos mensuales para un solo local.
