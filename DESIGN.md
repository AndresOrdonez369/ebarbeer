---
name: Bar Beer
description: Caja, jarras y metas de una barbería-bar, en una barra oscura donde cada barbero llena su jarra.
colors:
  bg: "#0c0906"
  bg-seam: "rgb(255 255 255 / 0.035)"
  wood: "#1a120b"
  wood-raised: "#23180e"
  line: "#3a2a1c"
  line-strong: "#5a4330"
  foam: "#f7ecd2"
  foam-dim: "#a8977f"
  foam-faint: "#8c7c67"
  amber: "#f2a20c"
  amber-light: "#f7b52c"
  amber-deep: "#c97806"
  amber-ink: "#1c1203"
  red: "#d8121f"
  red-hover: "#e8222f"
  red-lip: "#7e0a12"
  red-lip-deep: "#3d0509"
  blue: "#2a4fb5"
  blue-ink: "#c9d4f5"
  chrome: "#e8eaed"
  danger-text: "#ff6b6b"
typography:
  display:
    fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif"
    fontSize: "2.5rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  figure:
    fontFamily: "'Big Shoulders Display', 'Arial Narrow', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  body:
    fontFamily: "'Chakra Petch', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  body-sm:
    fontFamily: "'Chakra Petch', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  name:
    fontFamily: "'Chakra Petch', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "'Chakra Petch', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  none: "0px"
  r: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "16px"
  tap: "48px"
components:
  button-charge:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "64px"
  button-charge-hover:
    backgroundColor: "{colors.red-hover}"
  button-charge-disabled:
    backgroundColor: "{colors.red-lip}"
    textColor: "{colors.foam-dim}"
  button-foam:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.bg}"
    typography: "{typography.figure}"
    rounded: "{rounded.r}"
    height: "60px"
  button-foam-hover:
    backgroundColor: "#ffffff"
  button-foam-outline:
    textColor: "{colors.foam}"
    typography: "{typography.figure}"
    rounded: "{rounded.r}"
    height: "56px"
  button-foam-outline-hover:
    backgroundColor: "{colors.wood-raised}"
  button-outline:
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "0 12px"
    height: "40px"
  button-receipt-add:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    height: "{spacing.tap}"
  button-void:
    textColor: "{colors.danger-text}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    height: "{spacing.tap}"
  button-void-hover:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
  catalog-item:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "8px 12px"
    height: "{spacing.tap}"
  catalog-item-hover:
    backgroundColor: "{colors.wood-raised}"
  catalog-item-active:
    backgroundColor: "{colors.blue}"
  catalog-tab:
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "0 12px"
    height: "36px"
  catalog-tab-selected:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.bg}"
  pay-method:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "0 4px"
    height: "{spacing.tap}"
  pay-method-selected:
    backgroundColor: "{colors.blue}"
    textColor: "#ffffff"
  quick-cash:
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "0 4px"
    height: "{spacing.tap}"
  input-field:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
    padding: "0 14px"
    height: "52px"
  lineup-tile-selected:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
  bill-panel:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    rounded: "{rounded.none}"
    padding: "10px 12px 12px"
  held-chip:
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
    padding: "6px 12px"
    height: "{spacing.tap}"
  queue-banner:
    textColor: "{colors.amber}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "8px 12px"
  ledger-row:
    textColor: "{colors.foam}"
    padding: "12px 0"
  tab-bar:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.foam-dim}"
    typography: "{typography.label}"
    height: "56px"
  meta-stamp:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    padding: "1px 5px"
  void-stamp:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    padding: "2px 8px"
  checkbox:
    backgroundColor: "{colors.wood}"
    rounded: "{rounded.r}"
    size: "24px"
  checkbox-checked:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  receipt-ticket:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    rounded: "{rounded.none}"
    padding: "18px 16px 16px"
  placeholder-chip:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "6px 10px"
    height: "{spacing.tap}"
  chat-bubble:
    backgroundColor: "{colors.wood-raised}"
    textColor: "{colors.foam}"
    typography: "{typography.body-sm}"
    padding: "12px 14px"
  level-bar:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.r}"
    height: "16px"
  level-bar-sm:
    backgroundColor: "{colors.bg}"
    height: "8px"
  meta-stamp-inline:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    padding: "1px 6px"
  period-tab:
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    height: "{spacing.tap}"
  period-tab-selected:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.bg}"
  service-line:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    height: "56px"
  history-row:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    height: "52px"
  bonus-panel:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
    padding: "14px"
  button-form-foam:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.bg}"
    typography: "{typography.figure}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "56px"
  button-form-foam-hover:
    backgroundColor: "#ffffff"
  button-form-outline:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "{spacing.tap}"
  button-form-outline-hover:
    backgroundColor: "{colors.wood}"
  button-danger:
    textColor: "{colors.danger-text}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "{spacing.tap}"
  button-danger-hover:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
  select-field:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
    padding: "0 40px 0 14px"
    height: "52px"
  override-field:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
    width: "5.5rem"
    height: "52px"
  form-msg:
    textColor: "{colors.foam}"
    typography: "{typography.body-sm}"
  back-link:
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    height: "40px"
  confirm-box:
    textColor: "{colors.foam}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.r}"
    padding: "12px"
  admin-row:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    padding: "6px 0"
    height: "58px"
  value-chooser:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    height: "{spacing.tap}"
  value-chooser-selected:
    backgroundColor: "{colors.blue}"
    textColor: "#ffffff"
  confirm-box-neutral:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.r}"
    padding: "12px"
  period-stepper:
    textColor: "{colors.foam-dim}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    size: "{spacing.tap}"
  closing-panel:
    backgroundColor: "{colors.wood}"
    textColor: "{colors.foam}"
    typography: "{typography.title}"
    rounded: "{rounded.r}"
    padding: "16px"
  difference-line:
    textColor: "{colors.foam}"
    typography: "{typography.figure}"
  compare-bar:
    backgroundColor: "{colors.foam-dim}"
    height: "8px"
  payout-row:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    padding: "12px 0"
  offline-note:
    textColor: "{colors.amber}"
    typography: "{typography.name}"
    rounded: "{rounded.r}"
    padding: "8px 12px"
  closed-note:
    textColor: "{colors.foam-dim}"
    padding: "10px 16px"
  first-steps:
    textColor: "{colors.foam}"
    rounded: "{rounded.r}"
    padding: "16px"
  first-step-row:
    textColor: "{colors.foam}"
    typography: "{typography.name}"
    height: "60px"
  first-step-number:
    textColor: "{colors.foam-dim}"
    typography: "{typography.figure}"
    rounded: "{rounded.r}"
    size: "32px"
  first-step-number-next:
    textColor: "{colors.foam}"
  first-step-number-done:
    textColor: "{colors.amber}"
---

# Design System: Bar Beer

## Overview

**Creative North Star: "Jarra y cuchilla"**

El nombre del local convertido en instrumento. La app es una barra de bar de noche: suelo negro tostado con vetas de tablón apenas visibles, paneles de madera oscura con filetes marrones de 1 px, texto color espuma. Cada barbero tiene una jarra de cerveza cromada que se llena con los cortes del día hacia su meta. Esa jarra es la firma del sistema y aparece en la caja, en la vista del barbero y en la del administrador.

El sistema es denso y pensado para operar de pie, con una mano, en un local oscuro y ruidoso. La jerarquía sale del peso y de la caja alta, no de muchos tamaños: tres tamaños de trabajo para el texto y una escala aparte para las cifras. Cada color de acento tiene un solo oficio (ámbar para progreso y para lo que gana el barbero, rojo del logo para cobrar y alertar, azul del logo para seleccionar), y esa disciplina es la que hace legible la pantalla de un vistazo.

Rechaza dos cosas: el dashboard oscuro gris con chips redondeados y un único acento neón, y el disfraz metalero de calaveras y llamas. La materia es la barra, la madera, la espuma y el cromo; nada más.

**Key Characteristics:**
- Fondo negro tostado con vetas de tablón horizontales cada 140 px.
- Paneles de madera con filete marrón de 1 px y esquinas de 4 px.
- Cifras en Big Shoulders Display, en caja alta; todo lo escrito en Chakra Petch.
- Ámbar = progreso, lo que gana el barbero y las vueltas; el dinero vendido va en espuma; rojo = cobrar, anular, alertar; azul = selección como relleno; cromo = contorno de las jarras y de la placa BAR BEER.
- Jarra cromada que vierte una vez por sesión y rebosa solo al cruzar la meta.
- La jarra acostada (barra de nivel) para todo progreso que no es la jarra del día: bonos, días y meses del historial.
- Columna móvil; en escritorio, columna centrada de 520 px.
- Administración con un solo vocabulario de formulario: campos de madera de 52 px, una acción en espuma por formulario, confirmación en línea sin modales (roja si destruye, neutra si solo es irreversible).

## Colors

Una barra oscura de tonos cálidos con tres acentos tomados del logo y de la cerveza, cada uno con un único oficio.

### Primary
- **Ámbar cerveza** (amber): progreso, lo que gana el barbero y las vueltas a entregar. El dinero vendido (total del local, precios del catálogo, lo gastado por un cliente) no es ámbar: va en espuma. Cortes del día, comisión ganada (también la de cada servicio y lo ganado en el historial), premios de bonos, "Cumplida", bonos ganados, el conteo de un día que cumplió la meta, la cifra grande del barbero, las vueltas a entregar, lo que se debe a los barberos en Pagos ("Por pagar", "Va ganado" y el total de cada pago pendiente), las comisiones en Reportes (tira y columna "Comisión") y el premio de cada regla en la lista de Bonos, avisos de flujo ("Primero toca quién hizo el servicio", "… sigue corriendo: se marca como pagado cuando cierre"), el texto de lo que está por enviar y del aviso "Sin conexión", el número hecho de "Primeros pasos" (borde y visto dibujado), el contorno de foco, el cursor de texto, la selección de texto, el relleno de la casilla marcada y el borde superior de la cuenta (en la caja y en la boleta pública). Su versión **Ámbar claro** (amber-light) es la parte alta del degradado de la cerveza dentro de la jarra y de la barra de nivel; **Ámbar profundo** (amber-deep) es el fondo de ese degradado y el contorno discontinuo de lo pendiente (por enviar, el día anterior que quedó sin cierre y el aviso "Sin conexión"); **Tinta ámbar** (amber-ink) es el texto sobre ámbar y el visto dibujado de la casilla marcada.

### Secondary
- **Rojo del logo** (red): cobrar, anular y alertar. El botón Cobrar, el botón Entrar, el contorno y el relleno en hover del botón Anular cuenta y del botón de peligro de administración (Quitar acceso), el borde de la confirmación en línea, los sellos META y ANULADA y el punto de "en vivo". **Rojo encendido** (red-hover) es su estado hover; **Labio rojo** (red-lip) es el labio duro inferior del botón de cobro y su relleno cuando está desactivado; **Labio rojo hondo** (red-lip-deep) es el labio inferior del botón desactivado, para que conserve su volumen sin parecer activo.

### Tertiary
- **Azul del logo** (blue): selección, siempre como relleno. El barbero elegido en la fila de jarras, el método de pago elegido, el ítem del catálogo en el instante de tocarlo y el valor elegido en un selector de valor (la pestaña de la caja de un ítem en Catálogo; Cada, Se mide por y Premio en la ficha de un bono). **Tinta azul** (blue-ink) es el texto secundario sobre azul.

### Neutral
- **Negro de barra** (bg): el suelo de toda la app y de la barra de pestañas, y el final del degradado que separa la barra de Cobrar fija del contenido. Lleva vetas de tablón (bg-seam) de 1 px cada 140 px.
- **Madera** (wood) y **Madera alzada** (wood-raised): paneles, botones del catálogo, métodos de pago, campos de texto; la alzada es el hover y el estado pulsado, y el fondo de la burbuja de vista previa de la plantilla. La madera llana es también el fondo de la confirmación neutra y del resumen de caja cerrada, y el hover de las flechas del selector de periodo.
- **Filete** (line) y **Filete fuerte** (line-strong): reglas de 1 px entre bloques, bordes de botones y paneles; el fuerte para bordes de campos y casillas, de los botones de contorno, del botón de quitar, de las cuentas en espera, de los estados vacíos y del marco de "Primeros pasos" (con el cuadro numerado de cada paso), de los campos y selectores de los formularios, de los botones de contorno de formulario, de la confirmación neutra y del resumen de caja cerrada, de la perforación bajo la cabecera de la boleta pública y del vaso de la barra de nivel mediana (la pequeña usa el filete).
- **Espuma** (foam): texto principal, la espuma de la jarra y de la barra de nivel, el relleno de la pestaña de catálogo o de periodo seleccionada y de los botones de espuma (Enviar boleta por WhatsApp, Guardar plantilla), el relleno del botón principal de cada formulario de administración, el contorno de los botones de contorno espuma (Nueva cuenta, Guardar número), el texto de los botones de contorno de formulario, el borde y el número del paso siguiente en "Primeros pasos", el mensaje de estado correcto, la frase de vista previa de un bono, "Cuadra" y "Sobran $ X" en el cierre, y el dinero vendido o contado (total del local, precios del catálogo, lo gastado por cada cliente en Clientes, "Vendido" y las cifras por método en Reportes, "Debería haber en efectivo" y lo contado en el cierre).
- **Espuma apagada** (foam-dim): etiquetas, texto secundario, precios, pestañas inactivas, importes anulados, enlaces subrayados, el enlace de volver, las ayudas bajo los campos, la fecha escrita bajo un campo de fecha, el triángulo dibujado de los selectores, el chevrón de las filas de administración, la subetiqueta de esas filas, lo inactivo u oculto, la línea legal de la boleta pública, la nota de caja ya cerrada bajo "Hoy en el local", el complemento que acompaña a una cifra ("de <total>", "de Y", "/ 8 cortes", "de $ esperado"), lo ya saldado (la cifra de "Todo pagado", el total de un pago ya hecho, el premio tachado de un bono pausado, el importe tachado de una cuenta anulada) y el relleno de la barra plana de comparación de Reportes.
- **Espuma tenue** (foam-faint): placeholders, bordes en hover y el rótulo "Fase N" de las filas aún no disponibles en Más. Su valor alcanza 4,5:1 sobre madera, así que también sirve como texto pequeño.
- **Cromo** (chrome): solo el contorno de las jarras y el borde de la placa BAR BEER.
- **Texto de error** (danger-text): mensajes de error (también el mensaje de estado fallido de un formulario), el texto del botón de peligro, "Anulada", "Anulado" (en la lista de servicios del barbero), "Rechazada", el aviso de cuentas rechazadas, lo que falta en la caja ("Faltan $ X" en el cierre, "Faltó $ X" y la diferencia neta negativa en Cierres) y "Anulada por …" en Anulaciones, sobre el fondo oscuro; existe porque el rojo del logo no alcanza contraste como texto pequeño.
- **Negro de placa** (#000, literal en la placa): el segmento "BAR" y la sombra dura de la placa BAR BEER. Reproduce el logo; no es un token de interfaz.

### Named Rules
**The One Trade Rule.** Cada acento tiene un oficio y no presta servicio a otro: el ámbar no cobra, el rojo no selecciona, el azul no marca dinero. Si una cifra es dinero o progreso, es ámbar o espuma; nunca azul.

**The Fill-Only Blue Rule.** El azul aparece como relleno de un elemento seleccionado, nunca como texto, borde suelto ni enlace.

**The Chrome Is For Glass Rule.** El cromo contornea las jarras y la placa del logo. No se usa como color de borde de paneles ni de botones.

**The Earned Is Amber Rule.** El ámbar marca lo que gana un barbero (comisión, premios, lo ganado), el progreso y las vueltas a entregar. El dinero vendido (el total del local, los precios del catálogo, lo que gastó un cliente) va en espuma.

## Typography

**Display Font:** Big Shoulders Display 800 y 900 (con Arial Narrow)
**Body Font:** Chakra Petch 500 y 700 (con system-ui)

**Character:** Una condensada de cartel de bar, siempre en caja alta, para cifras y acciones; una técnica de esquinas cortadas para nombres, etiquetas y todo lo que se escribe. Ambas autoalojadas con @fontsource; solo se cargan esos cuatro pesos. Todo el cuerpo usa cifras tabulares.

### Hierarchy
- **Display** (800, 3.75rem, 1): la cifra de cortes del barbero junto a su jarra grande (en ámbar); en la pantalla de cobrada, el título "Cobrada" y las vueltas a entregar (ambos en 900). La cifra principal de cada pantalla de dinero va también aquí en 900, bajo su rótulo: "Debería haber en efectivo" en el cierre y "Vendido" en Reportes (espuma), "Por pagar" y "Va ganado" en Pagos (ámbar; espuma apagada con "Todo pagado").
- **Headline** (900, 2.5rem, 1): el total del día en el local, el total a pagar, las vueltas en el paso de pago, el total de la boleta pública y la cifra de la jarra de hoy en Metas (800, ámbar). Los títulos de página (Equipo, Ingresa, Cobro, Hoy, Historial, Metas, Más, Boleta por WhatsApp, Catálogo, Clientes, Datos del local, y el nombre de la persona o del ítem en sus fichas) usan el mismo tamaño en 800.
- **Title** (800, 1.75rem, 1): Cobrar con su total (en 900), cortes del día en la caja, importes de las filas de Hoy, títulos de estados vacíos, nombres de rol en el ingreso, la línea de avance de un bono ("Vas X de Y") y las cifras de la tira de totales del historial (en 900); en la boleta pública, "Boleta N.º" y "Gracias, <nombre>"; "Caja cerrada" (900) en el resumen del cierre, el total de cada fila de Pagos, el conteo "N cuentas" de Anulaciones y el título "Primeros pasos".
- **Figure** (800, 1.25rem, 1): precios del catálogo, conteos bajo cada jarra, importes de la cuenta, montos escritos en los campos de pago, encabezados de bloque ("Quién atendió", "La barra", "Por barbero", "Boleta por WhatsApp", "Así le llega", "Tus servicios de hoy", "Bonos", "Bonos ganados", y en administración "Datos", "Acceso", "Porcentajes especiales", "Orden en la caja", "Servicios", "Bebidas", "Productos"), el precio de una fila del catálogo, lo gastado por un cliente, la comisión de cada servicio, conteos e importes de las filas del historial, el premio de un bono, el monto de un bono ganado, el complemento "de Y" o "/ meta", el número del cuadro de cada paso en "Primeros pasos" y el texto de los botones de espuma y de contorno espuma (Enviar boleta, Guardar plantilla, Nueva cuenta, Guardar datos). En la fase de plata: el monto escrito en "Efectivo contado" y en los campos de monto de un bono, la línea de diferencia del cierre (en caja alta), las filas del resumen de caja cerrada, las cifras de las tiras de Reportes y Cierres (en 900), las columnas y filas de Reportes, el premio en la lista de Bonos, lo contado en cada fila de Cierres, el importe tachado de una anulación y los encabezados "Por barbero", "Por día", "Servicios", "Bebidas", "Productos" de Reportes.
- **Body** (500, 1rem, 1.4): texto base.
- **Body small** (500, 0.875rem): notas, ayudas, líneas de la cuenta; párrafos limitados a 44-52ch.
- **Name** (700, 0.875rem, 1.2): nombres de ítems, pestañas del catálogo y de periodo, nombres de servicio, día o mes de las filas del historial, nombres de bono, métodos de pago, botones de contorno y de formulario, el enlace de volver, nombres en las filas de administración, nombre del usuario en la cabecera, el periodo escrito entre las flechas del selector de periodo ("Semana pasada · 2 de nov – 8 de nov") "Pagado el …" con su visto, los pasos de "Primeros pasos" y los avisos bajo la cabecera ("Sin conexión", "N cuentas por enviar"). Los nombres bajo las jarras usan 700 a 0.75rem.
- **Label** (700, 0.75rem, 0.1em, MAYÚSCULAS, espuma apagada): rótulos de cifras y de campos ("Hoy en el local", "Total a pagar", "Efectivo recibido", "Vueltas", "Usuario o correo", "Cortes hoy", "Jarra de hoy", "Cortes", "Ganado", "Días", y el rótulo de cada campo de formulario: "Nombre o apodo", "Rol", "Ingresó", "Pestaña de la caja", "Efectivo contado", "Cada", "Se mide por", "Premio"), los rótulos de las cifras principales de dinero ("Debería haber en efectivo", "Vendido", "Por pagar", "Va ganado", "Todo pagado"), los encabezados de columna sobre las filas por barbero de Reportes ("Vendido", "Comisión", alineados a la derecha sobre su cifra) y la barra de pestañas (0.12em).

### Excepciones documentadas
Tamaños fuera de la escala que el sistema conserva a propósito:
- **Texto de campo** (1.125rem): el texto escrito en los campos del ingreso y de los formularios de administración, para que se lea bien al teclear.
- **Barra de pestañas densa** (0.6875rem, 0.02em): solo con más de cuatro pestañas, para que quepan.
- **Tira de cifras del barbero** (1.5rem): las tres cifras de "Ganado hoy", "Servicios" y "Vendido" comparten una tira de 390 px sin partir línea.
- **Placa grande** (22px): el texto de la placa BAR BEER en la pantalla de carga; la placa reproduce el logo y se mide en px como él.

### Named Rules
**The Rank By Weight Rule.** Tres tamaños de trabajo para texto (0.75, 0.875, 1rem) y cuatro para cifras (1.25, 1.75, 2.5, 3.75rem). El rango sale del peso y de la caja, no de inventar tamaños nuevos.

**The Figures Shout Rule.** Toda cifra que importa (dinero, cortes, metas) va en Big Shoulders Display en caja alta. Lo que se escribe o se lee como nombre va en Chakra Petch.

**The Label Names A Figure Rule.** El rótulo en mayúsculas espaciadas nombra la cifra o el campo que tiene debajo. No se coloca sobre títulos de sección como antetítulo decorativo.

## Layout

Móvil primero; el marco de referencia es un teléfono de 390 px. En pantallas anchas la app es una columna centrada de 520 px de ancho máximo (también la barra de pestañas fija). El margen lateral es de 16 px (gutter); los bloques del catálogo y la cuenta usan 12 px más 4 px internos para que las rejillas respiren hasta el borde.

El ritmo es compacto: separaciones de 4, 6 y 8 px dentro de grupos, 12-16 px entre bloques. Los bloques principales se separan con filetes horizontales de 1 px a todo lo ancho, no con tarjetas. La fila de jarras reparte una columna por barbero (hasta 6). El catálogo es una rejilla de dos columnas con objetivos de al menos 48 px de alto. Las cifras de resumen se alinean en tiras con divisores verticales de 1 px o, en Hoy, en una rejilla de tres columnas entre filetes.

La cabecera lleva la placa BAR BEER a la izquierda y sección, persona y fecha a la derecha. Debajo, con el margen de 16 px y 8 px antes del contenido, van los avisos de estado (sin conexión, cuentas por enviar, cuentas rechazadas), uno encima del otro. La barra de pestañas va fija abajo, 56 px más el área segura.

La barra de Cobrar es fija y va encima de la barra de pestañas (pegada a su borde superior), de modo que el total siempre está a la vista. Un degradado de transparente a negro de barra en sus primeros 14 px la separa del contenido que pasa por debajo. Cuando la página tiene esa barra, su relleno inferior se reduce a la altura de la barra de pestañas.

Las vistas del barbero (Hoy, Historial, Metas) son listas entre filetes: la lista de servicios en tres columnas (hora de 4.8rem, servicio, comisión a la derecha) y las filas del historial en cuatro (cuándo, nivel de 3.5 a 7rem, conteo de 2.6rem, dinero de 5.5rem) con 10 px de separación. Solo los paneles de bono son madera.

La caja avanza en tres pasos (cuenta, pago, cobrada) que se reemplazan en el sitio, sin rutas nuevas, con una entrada de 150 ms.

Las pantallas de administración son listas y fichas en la misma columna, con el margen de 16 px. Una lista lleva el título a la izquierda y, si se puede crear algo, un botón de contorno de formulario con un + a la derecha ("Agregar persona", "Agregar"), y debajo una nota en body small espuma apagada de 50ch. Una ficha (subpágina) abre con el enlace de volver y su título; sus bloques ("Datos", "Acceso", "Porcentajes especiales", "Orden en la caja") se separan con un filete de 1 px, 20 px de margen y 16 px de relleno superior. Dentro de un formulario los campos se apilan a 14 px; dos campos cortos van en una fila de dos columnas iguales con 10 px de separación (Rol e Ingresó, Precio y Comisión, Usuario y PIN, y los pares de botones).

Las pantallas de dinero (Cierre de caja, Reportes, Pagos, Cierres, Anulaciones) siguen un mismo orden: título, selector de periodo si lo hay, la cifra principal con su rótulo y una línea de complemento, tiras de cifras entre filetes y listas de filas entre filetes de al menos 52-60 px. Las tiras de Reportes y Cierres van en tres columnas (o dos) con 12 px de separación y 10 px arriba y abajo; las filas de Reportes usan columnas fijas a la derecha para que las cifras se alineen (por barbero 6.5rem y 5.5rem; por ítem cantidad y 6.5rem; por día 7.5rem, barra flexible y 6.5rem) con 10 px de separación. Cada lista que necesita explicación cierra con una leyenda de 0.75rem espuma apagada de 50ch.

## Elevation & Depth

Sistema plano. La profundidad viene del cambio de tono entre negro de barra, madera y madera alzada, y de los filetes de 1 px. No hay sombras ambientales en paneles ni botones.

### Shadow Vocabulary
- **Labio rojo** (`box-shadow: 0 3px 0 var(--red-lip)`): el borde inferior duro del botón rojo de acción principal (Cobrar, Entrar). Al pulsar, el botón baja 3 px y el labio desaparece.
- **Labio rojo desactivado** (`box-shadow: 0 3px 0 var(--red-lip-deep)`): el mismo labio cuando el botón está desactivado y su relleno pasa a labio rojo.
- **Placa del logo** (`box-shadow: 0 2px 0 #000, 0 6px 14px rgb(0 0 0 / 0.6)`): solo la placa BAR BEER, que reproduce el logo.
- **Foco de campo** (`box-shadow: 0 0 0 1px var(--amber)`): engrosa el borde ámbar del campo enfocado.

### Named Rules
**The Lip Belongs To Red Rule.** El labio duro es parte del botón rojo de acción principal. Ningún otro botón ni panel lleva sombra desplazada; la placa del logo no es un panel.

## Shapes

Esquinas de 4 px en todo (botones, campos, pestañas, mosaicos, estados vacíos). El panel de la cuenta es la excepción: esquinas rectas (0) bajo su borde superior ámbar de 3 px, como un ticket. Es una excepción deliberada y se conserva; el detector la marca como borde de acento sobre elemento redondeado, pero el panel no tiene radio. Bordes de 1 px sólidos para elementos asentados y de 1 px discontinuos para lo que todavía no lo está (ver la regla siguiente) y para separar líneas de la cuenta y del detalle de una cuenta, como la perforación de un ticket. La boleta pública repite la hoja de la cuenta: esquinas rectas bajo el mismo borde ámbar de 3 px. La placa BAR BEER se inclina -14° con su texto enderezado; los sellos META y ANULADA giran 8°. La burbuja de vista previa de la plantilla lleva 4 px en tres esquinas y la inferior izquierda recta, como un globo de chat. Las jarras son la única forma redondeada: fondo curvo y asa en arco con radios proporcionales a su ancho (15 % en el vaso, 12 % en la cerveza, 20 % en el asa), de modo que la misma jarra escala de pequeña a grande sin cambiar de silueta. La barra de nivel es esa jarra acostada: vaso de 4 px en la mediana y de 2 px en la pequeña (la mitad, para un alto de 8 px), con la cabeza de espuma redondeada hacia el lado lleno.

La confirmación en línea es el único recuadro de borde rojo: 1 px sólido de rojo del logo con esquinas de 4 px, sin relleno. Su variante neutra (para dinero irreversible que no destruye nada) es un recuadro de madera con filete fuerte de 1 px y las mismas esquinas; el resumen de caja cerrada usa el mismo marco sólido, porque lo cerrado está asentado.

**The Red Box Destroys Rule.** El recuadro rojo confirma solo lo que destruye o quita (quitar el acceso a alguien). Lo irreversible que no destruye (cerrar la caja, marcar un pago como hecho) se confirma en el recuadro neutro: madera, filete fuerte, "Cancelar" en contorno de formulario y el "Sí, …" en espuma.

**The Ticket Edge Rule.** Entre los paneles, el borde superior ámbar de 3 px pertenece solo a la cuenta del cliente: el panel de la cuenta en la caja y la boleta pública, que es esa misma cuenta ya cobrada. Ninguna otra hoja lo lleva; los estados "Boleta no encontrada" y "Sin conexión" usan el estado vacío.

**The Dashed Means Pending Rule.** Un contorno discontinuo de 1 px marca lo que aún no está asentado: la cuenta en espera (filete fuerte), la cuenta guardada por enviar y el aviso "N cuentas por enviar" (ámbar profundo, texto ámbar; también en el cierre, donde impide cerrar), el aviso "Ayer quedó sin cierre" (ámbar profundo, texto espuma, con "Cerrar ayer" en contorno), el aviso "Sin conexión" (ámbar profundo, texto ámbar), el estado vacío y el marco de "Primeros pasos" (filete fuerte). La nota de caja ya cerrada en la caja es sólida: lo cerrado está asentado. Lo cobrado y enviado lleva contorno sólido o ninguno. Lo rechazado se nombra con texto de error, no con ámbar.

## Components

### Buttons
Firmes y táctiles, pensados para el pulgar.
- **Forma:** esquinas de 4 px.
- **Cobrar / Entrar (principal):** rojo del logo, texto blanco en Big Shoulders caja alta, 60-64 px de alto, ancho completo, con labio rojo inferior de 3 px. En la caja lleva el total a la izquierda y una nota corta a la derecha ("Elegir pago", "Vueltas $ 8.000"). Hover a rojo encendido; al pulsar baja 3 px y pierde el labio. Desactivado conserva su identidad roja: relleno labio rojo, texto espuma apagada, labio rojo hondo.
- **Espuma (relleno):** relleno espuma, texto negro de barra en Big Shoulders 1.25rem, ancho completo, sin labio; 60 px (48 px en el detalle de Hoy) para Enviar boleta por WhatsApp, con icono de chat SVG de 22 px, y 56 px para Guardar plantilla. Hover a blanco; al pulsar se encoge a 0.98. Es la acción que cierra un flujo sin cobrar; nunca está en la pantalla del botón Cobrar y hay a lo sumo uno por pantalla.
- **Contorno espuma:** fondo transparente, filete espuma de 1 px, texto espuma. Nueva cuenta (Big Shoulders 1.25rem, 56 px, ancho completo, se encoge a 0.98 al pulsar) y Guardar número (Name, 52 px). Hover a madera alzada. Es la segunda acción cuando la pantalla ya tiene un relleno espuma.
- **Contorno:** fondo transparente, filete fuerte de 1 px, texto Name en espuma apagada, 40 px (Resto) o 48 px (montos rápidos, Descartar). Hover a madera con borde espuma tenue y texto espuma. "Agregar WhatsApp para enviar la boleta" es la variante de 48 px con texto espuma e icono de chat con +: abre el formulario plegado del número.
- **Enlace subrayado:** texto Name 0.875rem en espuma apagada, subrayado con 3 px de separación, 40 px de alto, sin borde (Cambiar, Cancelar, Volver al texto original, Poner en espera, Vaciar); hover a espuma.
- **Anular cuenta:** 48 px, contorno rojo del logo de 1 px y texto de error; hover se rellena de rojo con texto blanco.
- **Ítem del catálogo:** madera, filete de 1 px, nombre a la izquierda y precio en cifra a la derecha, mínimo 48 px. Hover a madera alzada con filete fuerte; al tocar se encoge a 0.97 y se rellena de azul durante 150 ms.
- **Botón de rol (ingreso):** como el ítem del catálogo, 64 px, rol en cifra y descripción en espuma apagada.
- **Volver:** texto Name en espuma apagada con chevrón SVG, 40 px, sin borde; hover a espuma sobre madera.
- **Enlace de volver (subpáginas):** encima del título de una ficha, el nombre de la sección madre ("Equipo", "Catálogo", "Más") en Name 0.875rem espuma apagada con chevrón de trazo de 18 px, 40 px de alto, corrido 6 px a la izquierda para alinear el trazo con el margen; hover a espuma. Es navegación, no un antetítulo: siempre enlaza y siempre nombra el lugar al que vuelve.
- **Botones de formulario (administración):** 48 px de alto mínimo, 16 px de relleno lateral, esquinas de 4 px; 150 ms; desactivados al 60 %.
  - **Espuma de formulario:** relleno espuma, texto negro de barra en Big Shoulders 1.25rem caja alta, 56 px, ancho completo. Es la única acción principal de cada formulario (Guardar datos, Crear persona, Guardar, Agregar), siempre al pie y bajo el mensaje de estado. Hover a blanco.
  - **Contorno de formulario:** filete fuerte de 1 px, texto Name en espuma (no apagada como el contorno de la caja). Es lo secundario: Cambiar PIN, Dar acceso, Guardar porcentajes, Subir / Bajar, Cancelar, y "Agregar" en la cabecera de una lista con un + de trazo. Hover a madera con borde espuma tenue.
  - **Peligro:** contorno rojo del logo de 1 px y texto de error; hover se rellena de rojo con texto blanco. Solo para quitar el acceso a alguien ("Quitar acceso" y su confirmación "Sí, quitar acceso").
- **Iconos:** SVG de trazo 2 px, 16-20 px, en espuma apagada; hover a espuma (y fondo madera en la salida de la cabecera).

### Chips
- **Pestañas del catálogo:** 36 px de alto, filete de 1 px, texto Name en espuma apagada. La seleccionada se rellena de espuma con texto negro de barra.
- **Pestañas de periodo (Historial):** Semana / Mes / Todo en tres columnas iguales de 48 px con 6 px de separación, filete de 1 px, esquinas de 4 px, texto Name en espuma apagada; hover a espuma con filete fuerte. La elegida se rellena de espuma con texto negro de barra, el mismo tratamiento que las pestañas del catálogo. Es un grupo de pestañas: siempre hay una elegida. La espuma marca que se navega (cambia lo que se ve); el azul del selector de valor marca que se elige un dato que se guarda.
- **Selector de periodo (administración):** las mismas pestañas de periodo (Día / Semana / Mes, o las que la pantalla use; con una sola, no se muestran) y debajo, a 6 px, una fila de paso: flechas de chevrón de 48 × 48 px a cada lado, sin borde, en espuma apagada (hover a espuma sobre madera), y en el centro el periodo escrito en Name ("Hoy · Mié 11 nov", "Semana pasada · 2 de nov – 8 de nov", "Noviembre 2026"), que se anuncia al cambiar. La flecha siguiente se desactiva al 30 % en el periodo en curso: no se navega al futuro. Una pantalla puede abrir en el periodo anterior (Pagos abre en la semana pasada) y cambiar de pestaña vuelve a ese punto de partida.
- **Cuentas en espera:** fila con desplazamiento horizontal de fichas de al menos 48 px, contorno discontinuo de filete fuerte, sin relleno: quién atendió en Name, primer ítem y hora en Label sin mayúsculas, total en cifra 1.25rem. Hover a madera con borde espuma tenue. Tocar una la retoma; quedan desactivadas mientras el catálogo no ha cargado.

### Selector de método de pago
Rejilla de 2 × 2 (Efectivo, Transferencia, Tarjeta, Mixto) con 6 px de separación, botones de 48 px en madera con filete de 1 px y texto Name espuma apagada. El elegido se rellena de azul con borde azul y texto blanco. Es un grupo de radio: siempre hay uno elegido.

### Selector de valor
La misma gramática que el método de pago aplicada a un dato que se guarda: en la ficha de un ítem del catálogo, "Pestaña de la caja" (Servicios, Bebidas, Productos) en tres columnas iguales con 6 px de separación, botones de 48 px en madera con filete de 1 px y texto Name espuma apagada; hover a espuma con filete fuerte. El elegido se rellena de azul con borde azul y texto blanco. Es un grupo de radio bajo un rótulo Label. No se confunde con las pestañas de periodo ni con las del catálogo de la caja, que se rellenan de espuma porque navegan. Es una sola pieza global, con tantas columnas como valores: la usan la ficha de un ítem del catálogo y la ficha de un bono ("Cada": Día, Semana, Mes; "Se mide por": Cortes, Ventas; "Premio": Monto fijo, % de su comisión).

### Montos rápidos
Bajo el campo de efectivo recibido, una fila de columnas iguales (tantas como montos) de 48 px con botones de contorno. El primero es "Exacto"; los demás son billetes redondeados hacia arriba. Debajo, "Vueltas" en Label y la cifra en ámbar 2.5rem 900.

### Pago mixto
Una fila por método: nombre en Name (7.5rem), campo de monto alineado a la derecha en cifra 1.25rem, y un botón de contorno "Resto" de 40 px que completa ese método con lo que falta. Bajo las filas, "Faltan", "Sobran" o "Suma exacta" en body small a la derecha (espuma apagada; espuma cuando cuadra).

### Casilla
Casilla de 24 px dibujada con la paleta: madera, filete fuerte de 1 px, esquinas de 4 px. Marcada se rellena de ámbar y aparece un visto dibujado en tinta ámbar (trazo de 2.5 px) que crece en 150 ms. Hover lleva el borde a espuma tenue. La fila completa es la etiqueta y mide al menos 48 px; el texto va en body small con una nota opcional en 0.75rem espuma apagada. Es una sola casilla global: la de la caja y la de los formularios de administración ("También atiende clientes", "Activo", "Cuenta como corte", "Visible en la caja") son la misma.

### Cards / Containers
- **Cuenta del cliente:** madera, filete de 1 px, borde superior ámbar de 3 px, esquinas rectas, padding 10-12 px. Cabecera "Cuenta" en Name mayúsculas 0.08em; líneas de al menos 40 px separadas por filete discontinuo, con botón de quitar de 32 px. Cada línea entra deslizando 4 px en 150 ms. Al pie, tras un filete, "Poner en espera" y "Vaciar" como texto subrayado en espuma apagada.
- **Aviso de cola:** bajo la cabecera, bloque de ancho completo con contorno discontinuo ámbar profundo, esquinas de 4 px, texto Name ámbar ("1 cuenta por enviar · enviando" con red, "1 cuenta por enviar · sin conexión" sin ella); enlaza a Hoy. Con cuentas rechazadas, contorno y texto pasan a texto de error ("1 cuenta rechazada · revisar").
- **Aviso sin conexión:** bajo la cabecera de toda pantalla, mientras no hay red: contorno discontinuo de 1 px ámbar profundo, esquinas de 4 px, 8/12 px de relleno, texto Name ámbar "Sin conexión · lo que ves puede estar atrasado y se pone al día solo"; se anuncia como estado y desaparece solo al volver la red. En la caja cede el lugar al aviso de cola cuando hay cuentas por enviar (que ya dice "sin conexión"); con cuentas rechazadas, los dos avisos van juntos.
- **Estado vacío:** borde discontinuo de 1 px en filete fuerte, esquinas de 4 px, título en cifra 1.75rem y cuerpo en espuma apagada. También es la forma de "Boleta no encontrada" y "Sin conexión" en la boleta pública, de un grupo vacío del catálogo ("Sin bebidas"), de Clientes ("Todavía sin clientes", "Sin coincidencias") y de la página de error.
- **Carga:** bloques de madera con un brillo que recorre de madera a madera alzada.
- **Nota de caja cerrada:** en la caja, cuando el cierre de hoy ya se hizo, una línea quieta bajo "Hoy en el local": 0.75rem espuma apagada, 10 px de relleno vertical y filete inferior sólido de 1 px ("Caja de hoy cerrada a las 11:55 a. m. · el efectivo que cobres ahora queda fuera de ese cierre"). Sólida, no discontinua: el cierre está asentado y la nota no pide actuar.

### Primeros pasos
En la primera pantalla del administrador de un local nuevo, hasta que hay barberos activos, ítems en el catálogo y al menos un acceso que no es de administrador: un marco discontinuo de 1 px en filete fuerte, esquinas de 4 px y 16 px de relleno, como el estado vacío. "Primeros pasos" en cifra 1.75rem, una nota en body small espuma apagada y una lista ordenada de pasos separados por filete sólido. Cada paso es un enlace completo de al menos 60 px en tres columnas (32 px, texto, 18 px) con 12 px de separación: un cuadro numerado de 32 px (filete fuerte, esquinas de 4 px, número en cifra 1.25rem espuma apagada), la acción en Name con su nota debajo en 0.75rem espuma apagada, y un chevrón de trazo de 18 px en espuma apagada (espuma en hover). El paso siguiente lleva el cuadro con borde y número en espuma; uno hecho lleva borde ámbar con un visto dibujado (trazo de 2.5 px), la acción en espuma apagada y "Hecho" como nota. Mientras se muestra y no hay barberos, el bloque "La barra" se oculta: los pasos ya dicen qué falta.

### Página de error
Una ruta que no existe o que falla: placa BAR BEER, el estado vacío ("Esta página no existe" o "Algo falló", con una frase que dice qué hacer y, si falló, que lo cobrado está a salvo) y, apilados a 10 px, "Ir al inicio" en espuma de formulario y, solo si falló, "Volver a intentar" en contorno de formulario. Columna con 20 px de separación y 24 px de relleno superior.

### Pantalla de cobrada
"Cobrada" (o "Por enviar" si quedó sin conexión) en cifra 3.75rem 900, con el total y el número de boleta debajo en espuma apagada. Si hay vueltas, son la cifra dominante: "Entrega de vueltas" en Label y el monto en ámbar 3.75rem 900 entre filetes, y el título baja a 2.5rem. Debajo, las jarras de los barberos que atendieron suben su nivel a los 350 ms; si atendió uno solo, aparece la jarra grande, centrada, con nombre y conteo más grandes; varios usan jarras pequeñas en fila. Tras un filete va el envío de boleta (plegado si la cuenta no tiene número) y al final Nueva cuenta en contorno espuma.

### Envío de boleta
Bloque en columna con 10 px de separación, en la pantalla de cobrada y en el detalle de una fila de Hoy (allí entre filetes y con el botón de 48 px). Con cliente: "Para <nombre> · teléfono" en body small espuma apagada con el nombre en espuma y el enlace subrayado "Cambiar" a la derecha; el botón espuma "Enviar boleta por WhatsApp" con icono de chat ("Reenviar boleta" si ya se abrió); tras abrirlo, "Abierta en WhatsApp a las … · confirma allá que se envió" en 0.75rem espuma apagada. Sin cliente: el botón de contorno "Agregar WhatsApp para enviar la boleta" (en la pantalla de cobrada) o directamente el formulario con dos campos de 52 px y "Guardar número" en contorno espuma. Al pie, "Ver la boleta como la ve el cliente" como enlace en espuma apagada.

### Boleta pública
La boleta que abre el cliente desde WhatsApp: placa BAR BEER grande centrada y debajo la hoja de la cuenta (madera, filete de 1 px, borde superior ámbar de 3 px, esquinas rectas, padding 18/16 px). Cabecera "Boleta N.º 0000" en cifra 1.75rem con local, fecha y hora en espuma apagada, cerrada por una perforación discontinua en filete fuerte; líneas de al menos 52 px separadas por filete discontinuo, con "Te atendió <barbero>" en 0.75rem; total en cifra 2.5rem 900 con "Total" en Label y "Pagado con …" debajo a la derecha. Anulada: importes tachados en espuma apagada, sello ANULADA en la fila del total y nota en texto de error. Fuera de la hoja, una jarra grande llena y quieta sobre "Gracias, <nombre>" en cifra 1.75rem, y la línea legal en 0.75rem espuma apagada.

### Libro de Hoy
- **Fila de cuenta:** botón de ancho completo, 12 px arriba y abajo, filete inferior de 1 px. Número y hora en Name 0.75rem espuma apagada; resumen en body small con elipsis; total en cifra 1.75rem a la derecha; chevrón SVG de 20 px que gira 90° al abrir; método o estado en 0.75rem debajo.
- **Anulada:** total y resumen tachados en espuma apagada, "Anulada" en texto de error.
- **Rechazada:** "Rechazada" en texto de error, sin contorno.
- **Por enviar:** la fila lleva contorno discontinuo ámbar profundo con esquinas de 4 px y 10 px de relleno lateral; "Por enviar" en ámbar. Encima, un botón de contorno discontinuo igual: "Reintentar envío ahora".
- **Detalle:** líneas con filete discontinuo, pagos, el envío de boleta entre filetes (si la cuenta tiene número), campo "Motivo para anular" y el botón Anular cuenta.

### Inputs / Fields
- **Estilo:** 52 px de alto, madera, filete fuerte de 1 px, esquinas de 4 px, texto 1.125rem. Rótulo Label encima. Los campos de monto escriben en cifra 1.25rem alineada a la derecha.
- **Hover / Foco:** hover lleva el borde a espuma tenue; el foco lo vuelve ámbar con un anillo de 1 px, sin contorno extra.
- **Error:** mensaje en texto de error bajo los campos, con altura reservada para que nada salte.
- **Selector:** el mismo campo de 52 px sin la flecha del sistema; un triángulo pequeño dibujado en espuma apagada a 14-20 px del borde derecho y 40 px de relleno derecho para que el texto no lo pise.
- **Ayuda:** bajo el campo, 0.75rem espuma apagada, a 6 px; dice para qué sirve el dato, no repite el rótulo.
- **Fecha:** el campo de fecha lleva debajo, en el lugar de la ayuda, la fecha escrita en español ("11 de noviembre de 2026"), para que se lea igual en cualquier teléfono.
- **Mensaje de estado:** una línea en body small sobre el botón principal, con altura reservada (1.2em) para que nada salte. Correcto en espuma ("Guardado. Aplica desde el próximo cobro."); fallido en texto de error. Es un estado que se anuncia, no un aviso que se cierra. Cuando un formulario arma una regla, encima del mensaje va una frase de vista previa en body small espuma (46ch, con altura reservada) que la dice en palabras llanas, y se actualiza mientras se escribe.
- **Área de texto:** como el campo (madera, filete fuerte, 4 px, foco ámbar), texto body con interlineado 1.5, mínimo 120 px, sin tirador; crece con su contenido para que la vista previa quede justo debajo.

### Editor de plantilla
Rejilla de dos columnas de fichas de dato (6 px de separación): contorno de filete fuerte, esquinas de 4 px, al menos 48 px, el token en Name espuma y su ayuda en 0.75rem espuma apagada; hover a madera con borde espuma tenue; tocar una inserta el token en el cursor. Debajo, el área de texto que crece, "Volver al texto original" como enlace subrayado, "Así le llega" en cifra 1.25rem y la vista previa como burbuja de chat: madera alzada, filete de 1 px, esquina inferior izquierda recta, body small con interlineado 1.5. Al final, Guardar plantilla en espuma.

### Filas de Más
Lista entre filetes de 1 px, filas de 52 px. Lo disponible es un enlace en Name espuma con chevrón SVG de 20 px en espuma apagada (espuma en hover). Lo que aún no existe es texto espuma apagada con "Fase N" a la derecha en 0.75rem 700 mayúsculas 0.08em espuma tenue, sin chevrón ni hover.

### Filas de administración
Listas entre filetes de 1 px (Equipo, Catálogo), filas de al menos 58-60 px que son un enlace completo a la ficha: a la izquierda el nombre en Name y debajo una subetiqueta en 0.75rem espuma apagada (rol; comisión y "cuenta como corte"); a la derecha un valor (el usuario de acceso en body small, espuma si tiene acceso y apagada si no; el precio en cifra 1.25rem espuma); al final un chevrón de trazo de 18 px en espuma apagada. Lo inactivo o lo oculto en la caja queda en la lista, apagado y tachado (el nombre de la persona inactiva, el precio del ítem oculto), con la razón en la subetiqueta ("Inactivo", "Oculto en la caja"). Las filas de Clientes usan la misma forma sin chevrón porque no abren nada: nombre y teléfono a la izquierda, lo gastado en cifra 1.25rem espuma y "N visitas · cuándo" a la derecha, o "Sin compras" en espuma apagada.

### Campos de excepción
Para un valor que normalmente se hereda (el porcentaje especial de un barbero por servicio): filas de 64 px entre filetes, el nombre en Name con el valor general en la etiqueta ("General 50%", 0.75rem espuma apagada) y a la derecha un campo de 5.5rem alineado a la derecha seguido de "%". Vacío muestra "—": hereda el general. Solo se escribe cuando el barbero gana distinto. Una nota encima explica el "—" y que el cambio no mueve lo ya cobrado.

### Confirmación en línea
Lo destructivo se confirma en el sitio, nunca en un modal. El par de botones se reemplaza por un recuadro de 1 px rojo del logo, esquinas de 4 px, 12 px de relleno y 10 px de separación: la pregunta en body small, que nombra a la persona y lo que se conserva ("¿Quitar el acceso a Mono? … Su historial se conserva."), y debajo, en la fila de dos columnas, Cancelar en contorno de formulario y "Sí, quitar acceso" en peligro. Si la acción no se permite (quitarse el propio acceso), el botón queda desactivado y una ayuda dice por qué.
- **Neutra (dinero irreversible, no destructivo):** cerrar la caja y marcar un pago. El botón se reemplaza en el sitio por un recuadro de madera, filete fuerte de 1 px, esquinas de 4 px, 12 px de relleno y 10 px de separación: la pregunta en body small nombra la cifra, a quién y el periodo, y dice que no se puede deshacer ("¿Le pagaste $ 745.500 a Mono por la semana del 2 al 8 de nov? Queda registrado y no se puede deshacer."); debajo, en la fila de dos columnas, "Cancelar" en contorno de formulario y "Sí, cerrar" o "Sí, pagado" en espuma de formulario. Si falla, el error va dentro del recuadro, en texto de error.

### Cierre de caja
La caja cuenta el efectivo al final del día. Abre con "Cierre" como título y "Hoy · <fecha>" (o "Ayer") en body small espuma apagada.
- **Lo esperado:** "Debería haber en efectivo" en Label sobre la cifra en espuma 3.75rem 900 y una ayuda en 0.75rem espuma apagada (46ch) que dice qué cuenta y qué no; cierra con un filete.
- **Contado:** campo de monto "Efectivo contado" (cifra 1.25rem a la derecha) con su ayuda. Debajo, la línea de diferencia en vivo, alineada a la derecha, en cifra 1.25rem caja alta, con altura reservada: "Cuadra" y "Sobran $ X" en espuma, "Faltan $ X" en texto de error. Lo que sobra no es ganancia: no va en ámbar.
- **Nota:** área de texto opcional (mínimo 120 px); si no cuadra, el placeholder y la ayuda piden la razón.
- **Cerrar:** "Cerrar caja" en espuma de formulario, que pasa a la confirmación neutra ("Cancelar" / "Sí, cerrar"). Con cuentas por enviar en el celular, el aviso discontinuo ámbar lo explica y el botón queda desactivado. Si ayer quedó sin cierre, el aviso discontinuo "Ayer quedó sin cierre" va primero, con "Cerrar ayer" en contorno de formulario.
- **Caja cerrada:** recuadro de madera con filete fuerte, esquinas de 4 px y 16 px de relleno. "Caja cerrada" en cifra 1.75rem 900 caja alta; filas de al menos 44 px con filete sólido (Debía haber, Contado, Diferencia): rótulo en body small espuma apagada y cifra 1.25rem a la derecha, la diferencia en caja alta y en texto de error si faltó; la nota entre comillas en body small espuma; "Cerró <persona> · <hora>" en 0.75rem espuma apagada.

### Reportes
- **Vendido:** "Vendido" en Label sobre la cifra en espuma 3.75rem 900, y debajo una línea en body small espuma apagada ("254 cuentas · promedio $ 26.848 · 1 anulada").
- **Tiras:** entre filetes, Efectivo / Transferencia / Tarjeta en tres columnas y Cortes / Comisiones en dos; rótulo Label y cifra 1.25rem 900 sin partir línea. Comisiones va en ámbar; lo demás en espuma. Una nota de 0.75rem dice que las comisiones no incluyen bonos.
- **Descargar CSV:** contorno de formulario a todo lo ancho con icono de descarga de 18 px; debajo, el mensaje de estado ("Descargado: N líneas.", "No hay ventas en este periodo."). El archivo se separa con punto y coma y lleva BOM, para que Excel en español lo abra con acentos y columnas.
- **Por barbero:** encabezados de columna en Label alineados a la derecha ("Vendido", "Comisión") y filas de 52 px: nombre en Name con "N cortes" en 0.75rem espuma apagada, lo vendido en cifra 1.25rem espuma y la comisión en ámbar.
- **Por tipo:** "Servicios", "Bebidas", "Productos" como encabezados en cifra 1.25rem; filas con nombre, "× N" en body small espuma apagada y lo vendido en cifra.
- **Por día:** filas con el día y "N cuentas", la barra plana de comparación y lo vendido; cierra con la leyenda "La barra compara cada día con el mejor del periodo."

### Barra plana de comparación
Para comparar dinero vendido entre días, no progreso hacia una meta: 8 px de alto, filete de 1 px, esquinas de 2 px, sin fondo; el relleno es espuma apagada lisa, sin degradado, burbujas ni cabeza de espuma. La escala es relativa al mejor día del periodo y se escribe en la leyenda. La cerveza (jarra y barra de nivel) queda para el progreso; lo vendido no se sirve en jarra.

### Bonos (administración)
- **Lista:** filas de administración de 60 px: nombre en Name con la meta como subetiqueta ("40 cortes por semana"); a la derecha el premio en cifra 1.25rem ámbar con su nota en 0.75rem espuma apagada ("de premio", "sobre su comisión") y el chevrón. Pausado: nombre en espuma apagada, "Pausado · …" en la subetiqueta y el premio tachado en espuma apagada. Al pie, una ayuda y "Calcular bonos pendientes" en contorno de formulario con su mensaje de estado.
- **Ficha:** el formulario de administración con selectores de valor para Cada, Se mide por y Premio; los campos de umbral y monto escriben en cifra 1.25rem a la derecha; casilla Activo; la frase de vista previa sobre el mensaje de estado; "Crear bono" o "Guardar" en espuma.

### Pagos a barberos
- **Por pagar:** "Por pagar" en Label sobre la cifra en ámbar 3.75rem 900 con una ayuda en 0.75rem espuma apagada. Si el periodo sigue corriendo, el rótulo dice "Va ganado" y la ayuda pasa a ámbar ("… sigue corriendo: se marca como pagado cuando cierre"); si todo está pagado, "Todo pagado" y la cifra en espuma apagada.
- **Fila de pago:** 12 px arriba y abajo, filete inferior. Nombre en Name con "N cortes" debajo; a la derecha el total en cifra 1.75rem ámbar (espuma apagada si ya se pagó). Debajo, "Comisión $ X + bonos $ Y" en 0.75rem espuma apagada. Pendiente: "Marcar pagado" en contorno de formulario, alineado a la izquierda, que abre la confirmación neutra en la misma fila. Pagado: visto de trazo de 18 px y "Pagado el <día>" en Name espuma. El mensaje correcto va bajo la lista; el error, dentro de la fila.

### Historiales de administración (Cierres, Anulaciones)
Listas de solo lectura entre filetes, con el selector de periodo arriba.
- **Cierres:** tira de tres columnas (Cierres, No cuadraron, Diferencia neta; la neta en texto de error si es negativa). Filas de 60 px: día en Name con "<persona> · <hora>" debajo; a la derecha lo contado en cifra 1.25rem con "de $ <esperado>" en 0.75rem espuma apagada; "Cuadró" en 0.75rem 700 espuma apagada o "Faltó $ X" en texto de error; la nota entre comillas a todo lo ancho en 0.75rem espuma.
- **Anulaciones:** encima, "N cuentas" en cifra 1.75rem y "por $ X que no se cobraron" en body small espuma apagada. Filas: número, día y hora en 0.75rem 700 espuma apagada; el motivo en Name; el importe en cifra 1.25rem tachado en espuma apagada; "Anulada por <persona> a las <hora>" en 0.75rem texto de error.

### Navigation
- **Barra de pestañas:** fija abajo, negro de barra, filete superior de 1 px, pestañas iguales en Label 0.12em espuma apagada. La activa pasa a espuma y lleva una marca ámbar interior de 3 px arriba. Con más de cuatro pestañas el espaciado baja a 0.02em y el tamaño a 0.6875rem. Una subpágina enciende la pestaña de su sección (por ejemplo, la plantilla de la boleta enciende Más).
- **Cabecera:** placa BAR BEER, sección · persona en Name espuma, fecha en Label sin mayúsculas, botón de salir de 40 px.
- **Barra de Cobrar:** fija sobre la barra de pestañas, con el degradado a negro de barra descrito en Layout.
- **Foco global:** contorno ámbar de 2 px con 2 px de separación.

### Jarra (firma)
Jarra cromada de vidrio con asa, en dos tamaños: pequeña (40 × 60 px, borde 2 px) en la fila de jarras y grande (112 × 164 px, borde 4 px) en la vista del barbero y en la pantalla de cobrada con un solo barbero. Toda su geometría (radios, asa, espuma) es proporcional al ancho y al alto de la jarra. La cerveza es un degradado de ámbar claro a ámbar profundo con burbujas puntuales y un sombrero de espuma; al alcanzar la meta la espuma se ensancha por encima del borde.

Movimiento: la primera pantalla de la sesión vierte las jarras hasta su nivel (900 ms, una sola vez); después cada corte sube el nivel con una transición de 450 ms. Las burbujas solo se mueven mientras algo cambia y se detienen a los 1,6 s. Rebosar ocurre solo cuando el conteo cruza la meta (450 ms). Todo lo demás es un cambio de estado de 150 ms. Con movimiento reducido, todo se vuelve instantáneo.

### Barra de nivel ("la jarra acostada")
La jarra tumbada: el nivel de cerveza para todo progreso que no es "los cortes de hoy" (un bono, un día o un mes del historial). Vaso con fondo negro de barra y borde de 1 px; cerveza en el degradado de la jarra (ámbar claro a ámbar profundo); en el borde del nivel, una cabeza de espuma con cuerpo, redondeada hacia el lado lleno, que aparece en cuanto hay cerveza.
- **Mediana (16 px):** borde filete fuerte, esquinas de 4 px, burbujas puntuales blancas al 45 % en trama de 11 × 8 px, cabeza de espuma de 10 px. Es la barra de los paneles de bono.
- **Pequeña (8 px):** borde filete, esquinas de 2 px, sin burbujas, cabeza de espuma de 5 px. Es la barra de las filas del historial.
- **Llena:** la espuma rebasa el extremo del vaso (3 px arriba y abajo y 6 px más allá en la mediana; 2 y 4 px en la pequeña). La mediana puede llevar el sello META sobre el extremo; en los paneles de bono se apaga y se usa el META en línea.
- **Escala:** siempre explícita y escrita debajo en una leyenda de 0.75rem espuma apagada. En las filas de día, contra la meta diaria de cortes ("La barra es tu jarra del día: llena = 8 cortes."); en las de mes, contra el promedio por día trabajado ("La barra es tu jarra promedio por día trabajado en ese mes: llena = 8 cortes."); en un bono, contra su umbral, que la línea de avance escribe.
- **Movimiento:** vierte una vez por sesión (900 ms), como las jarras; después el nivel cambia en 450 ms. Las burbujas son una trama quieta. El rebose no se anima: la barra aparece llena.
Es muda para lectores de pantalla; la cifra escrita a su lado dice lo mismo.

### Sellos (META y ANULADA)
Una sola gramática: etiqueta de relleno rojo del logo, texto blanco en Chakra Petch 700 en mayúsculas espaciadas, sin radio, girada 8°. Marca un hecho consumado, nunca decora.
- **META:** 10 px, espaciada 0.12em, sobre la esquina de la jarra. Golpea (desde 2.4× y -14°, 450 ms) solo en el momento en que el conteo cruza la meta; en cualquier otro render simplemente está.
- **META en línea:** en el panel de un bono cumplido, delante de la línea de avance: 0.75rem, espaciada 0.12em, padding 1/6 px, girada 8° y subida 3 px. Estática. Sobre la barra de nivel mediana el sello es el de 10 px con padding 1/6 px.
- **ANULADA:** 0.875rem, espaciada 0.14em, padding 2/8 px, en la fila del total de la boleta pública, entre el rótulo y la cifra tachada. Estática.

### Fila de jarras
Un mosaico por barbero con sello, jarra, nombre y conteo "cortes/meta". En la caja es seleccionable: hover a madera con filete, seleccionado relleno azul con borde blanco al 25 % y el "/meta" en tinta azul. En barbero y admin es de solo lectura.

### Vista del barbero (solo lectura)
Las tres pantallas del barbero (Hoy, Historial, Metas) solo leen: nada se cobra, se edita ni se anula. Lo único que se toca son las pestañas de periodo, la barra de pestañas y la salida; no hay botón rojo ni de espuma.
- **Lista de servicios (Hoy):** filas de al menos 56 px con filete inferior. Hora en 0.75rem 700 espuma apagada; servicio en Name ("× N" si hay cantidad) con una subetiqueta en 0.75rem 500 espuma apagada: "+N a la jarra" en los cortes, "Anulado" en texto de error si se anuló. A la derecha, la comisión en cifra 1.25rem ámbar y "de <total>" en 0.75rem espuma apagada. Anulado: nombre y comisión tachados en espuma apagada; la fila nunca se oculta.
- **Tira de totales (Historial):** entre filetes, tres columnas (Cortes, Ganado, Días) con rótulo Label y cifra en 1.75rem 900 sin partir línea; Ganado en ámbar. Todas las cifras llevan separador de miles, también los conteos. En Todo, debajo, "Desde el <fecha> · promedio N cortes por día" en body small espuma apagada.
- **Filas de día y de mes (Historial):** al menos 52 px con filete inferior, en las cuatro columnas de Layout: cuándo (día o mes en Name, y "N servicios" o "N días" en 0.75rem espuma apagada), la barra de nivel pequeña, el conteo de cortes y la comisión en cifra 1.25rem a la derecha. El conteo de un día que cumplió la meta pasa a ámbar. La lista cierra con la leyenda de escala de la barra.
- **Jarra de hoy (Metas):** entre filetes, la jarra pequeña con su sello META y, al lado, "Jarra de hoy" en Label sobre la cifra en ámbar 2.5rem con "/ <meta> cortes" en 1.25rem espuma apagada.
- **Panel de bono (Metas):** madera, filete de 1 px, esquinas de 4 px, 14 px de relleno y 8 px entre filas; los paneles se apilan a 10 px. Arriba, el nombre en Name y, alineados a la derecha, periodo y rango ("Esta semana · 9 de nov – 15 de nov") en 0.75rem espuma apagada. Luego la línea de avance en cifra 1.75rem: "Vas X" (con "en ventas" si la meta es de ventas) y "de Y" en 1.25rem espuma apagada que no parte línea; cumplida, la línea pasa a ámbar y lleva delante el META en línea. Debajo, la barra de nivel mediana sin sello. Al pie, en 0.75rem espuma apagada: el premio en cifra 1.25rem ámbar con su nota ("de premio", "sobre tu comisión") y a la derecha "Faltan …" o "Cumplida" en ámbar 700.
- **Bonos ganados (Metas):** lista entre filetes, filas de al menos 52 px: nombre de la regla en Name con su periodo debajo en 0.75rem espuma apagada (rango de semana en las semanales, nombre del mes en las mensuales, el día en las diarias) y el monto en cifra 1.25rem ámbar a la derecha. Sin bonos, una nota en body small espuma apagada.

### Placa BAR BEER
La hoja del logo: segmentos negro "BAR", rojo con la jarra y azul "BEER", texto blanco 700 espaciado 0.16em, borde cromo de 2 px, inclinada -14°. Tamaño mediano en la cabecera y grande (texto de 22 px) en la pantalla de carga. Su negro y sus medidas en px reproducen el logo y no se tokenizan.

## Do's and Don'ts

### Do:
- **Do** asignar el ámbar a progreso y dinero, el rojo a cobrar/anular/alertar y el azul a selección como relleno.
- **Do** escribir cada cifra importante en Big Shoulders Display caja alta, en la escala 1.25 / 1.75 / 2.5 / 3.75rem.
- **Do** separar bloques con filetes de 1 px a todo lo ancho y usar madera solo para lo que se toca o se arma.
- **Do** mantener objetivos táctiles de al menos 48 px y el botón de cobro de ancho completo con su labio rojo de 3 px.
- **Do** usar 150 ms para cambios de estado y 450 ms (cubic-bezier(0.16, 1, 0.3, 1)) para movimientos de nivel, rebose y sello.
- **Do** reservar el vertido de la jarra para la primera pantalla de la sesión y el rebose y el sello META para el cruce de la meta.
- **Do** marcar con contorno discontinuo lo que aún no está asentado (en espera, por enviar, vacío) y con texto de error lo rechazado o anulado.
- **Do** mantener la barra de Cobrar fija sobre la barra de pestañas, con su degradado a negro de barra.
- **Do** hacer de las vueltas la cifra dominante, en ámbar, cuando hay que entregarlas.
- **Do** usar un solo relleno espuma por pantalla para la acción que cierra un flujo sin cobrar; la acción que lo acompaña va en contorno espuma.
- **Do** usar la jarra para los cortes de hoy y la barra de nivel para todo otro progreso, siempre con su escala escrita en una leyenda o en la línea de avance.
- **Do** dar a cada formulario de administración una sola acción en espuma; lo secundario va en contorno de formulario y el contorno rojo de peligro solo quita acceso.
- **Do** confirmar lo destructivo en línea, en un recuadro de 1 px rojo del logo con la pregunta, Cancelar y "Sí, quitar …".
- **Do** confirmar el dinero irreversible que no destruye nada (cerrar la caja, marcar un pago) en el recuadro neutro de madera y filete fuerte, con una pregunta que nombra la cifra, a quién y el periodo, y el "Sí, …" en espuma.
- **Do** rellenar de azul el valor elegido en un selector de valor y de espuma la pestaña que navega.
- **Do** mostrar un valor heredado como "—" con el valor general escrito en la etiqueta.
- **Do** abrir cada subpágina con el enlace de volver al lugar de donde viene, encima del título.
- **Do** dar a cada pantalla de dinero una sola cifra principal de 3.75rem 900 bajo su rótulo: espuma si es vendido o contado, ámbar si es lo que se debe o se ganó.
- **Do** escribir lo que falta en la caja en texto de error y lo que cuadra o sobra en espuma.
- **Do** comparar dinero vendido con la barra plana en espuma apagada, con su escala en la leyenda.
- **Do** avisar la falta de conexión bajo la cabecera, en discontinuo ámbar profundo; si el aviso de cola ya dice "sin conexión", no repetirlo.
- **Do** seguir con " · " la frase que viene tras una hora ("a las 11:55 a. m. · el efectivo…"); nunca cerrar una oración justo después de "a. m." o "p. m.".

### Don't:
- **Don't** convertir la app en un dashboard gris oscuro con chips redondeados y un acento neón.
- **Don't** recurrir a calaveras, llamas ni a ningún disfraz metalero.
- **Don't** poner el borde superior ámbar de 3 px en ningún panel que no sea la cuenta del cliente (en la caja o en la boleta pública), ni en los estados vacíos de la boleta.
- **Don't** dar sombra desplazada a nada que no sea el botón rojo de acción principal (la placa del logo conserva la suya como parte del logo).
- **Don't** usar el azul como texto ni el rojo del logo como texto pequeño; para errores está el texto de error.
- **Don't** colocar rótulos en mayúsculas espaciadas encima de títulos de sección como antetítulo.
- **Don't** dejar burbujas ni otros elementos animándose en reposo; el movimiento acompaña un cambio y se detiene.
- **Don't** usar contorno discontinuo en algo ya cobrado y enviado.
- **Don't** abrir modales para confirmar; la confirmación ocupa el lugar de los botones.
- **Don't** pintar de ámbar el dinero vendido (totales, precios, lo gastado por un cliente); el ámbar es lo que gana el barbero.
- **Don't** ocultar de una lista de administración lo inactivo u oculto; se apaga y se tacha.
- **Don't** usar el recuadro rojo para confirmar algo que no destruye (cerrar la caja, marcar un pago); el rojo confirma solo lo que quita.
- **Don't** servir en cerveza (jarra o barra de nivel) una comparación de dinero vendido; la cerveza es progreso hacia una meta.
- **Don't** dejar navegar el selector de periodo hacia el futuro; la flecha siguiente se apaga en el periodo en curso.
- **Don't** usar contorno discontinuo ni ámbar en la nota de caja ya cerrada; lo cerrado está asentado y la nota no pide actuar.
