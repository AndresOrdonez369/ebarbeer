---
version: 1
slug: "src-routes-caja-page-svelte"
primary_target: "src/routes/caja/+page.svelte"
related_targets: ["src/routes/barbero/+page.svelte","src/routes/admin/+page.svelte","src/routes/ingreso/+page.svelte"]
---

Scope: the operating app (caja, barbero, admin, ingreso). Visitor mode: Operate. Mobile-first, 390 px phone is the primary frame.

Audience and task: cajera cobrando de pie en un local oscuro y ruidoso; barbero mirando sus números entre clientes; admin vigilando el día. Primary task: armar la cuenta del cliente y cobrarla en el menor número de toques.

## Direction contract

THESIS: Jarra y cuchilla. The shop's own name made into the instrument: every barber owns a beer mug that fills with today's cuts toward the goal. Refuses the category default of a grey dark dashboard with rounded chips and one neon accent, and refuses the metal costume of skulls and flames.

OWN-WORLD: roasted black ground with barely visible plank seams; dark-wood panels with 1 px brown rules; foam-white text; beer amber owns progress and money; logo red owns charge, void and alerts; logo blue owns selection as a fill; chrome outlines the mugs and the BAR BEER blade plate. Big Shoulders Display caps for figures and actions, Chakra Petch for names, labels and everything typed. 4 px corners, a hard lower lip on the charge button.

STORY: the cashier sees who is cutting and how far each barber is from the goal, builds the customer's bill, charges, and sends the receipt by WhatsApp. The barber sees his mug fill. The admin sees the whole bar pour in real time.

FIRST VIEWPORT: blade plate top left with cashier and date top right; today's total large in foam with cuts count in amber; a row of five mugs with name and count, selected barber filled blue, goal reached shows red META stamp; catalog tabs (Servicios, Bebidas, Productos) over a two-column grid of 48 px buttons; the customer's bill panel with amber top edge, lines and figures; full-width red Cobrar with total; bottom tab bar Caja · Hoy · Cierre.

FORM: Jarra y cuchilla, candidate 4 of the grounded list, seed:4960209b7d561764

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction and motion grammar: mugs pour to their level on first load (900 ms, once); a charged service raises that barber's mug one step and the foam settles (≤500 ms); crossing the goal makes the foam overflow and the META stamp slam in (450 ms); every other change is a 150 ms state swap; bubbles move only during a change, then rest; reduced motion turns all of it into instant swaps.

Unresolved: real catalog and prices; daily goal per barber; real logo in vector form.
