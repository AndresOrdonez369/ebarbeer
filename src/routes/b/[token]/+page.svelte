<!-- The customer's receipt, opened from the WhatsApp link. Public, no account, no phone shown. -->
<script lang="ts">
	import { page } from '$app/state';
	import BrandMark from '#lib/components/BrandMark.svelte';
	import Mug from '#lib/components/Mug.svelte';
	import { amount, methodLabel, money } from '#lib/format.js';
	import { backend } from '#lib/session.svelte.js';
	import type { PublicReceipt } from '#lib/types.js';

	let receipt = $state<PublicReceipt | null>(null);
	let status = $state<'loading' | 'ok' | 'missing' | 'error'>('loading');

	$effect(() => {
		const token = page.params.token ?? '';
		status = 'loading';
		backend
			.publicReceipt(token)
			.then((r) => {
				receipt = r;
				status = r ? 'ok' : 'missing';
			})
			.catch(() => (status = 'error'));
	});

	const day = $derived(
		receipt ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(receipt.createdAt)) : ''
	);
	const time = $derived(
		receipt
			? new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(receipt.createdAt))
			: ''
	);
	const methods = $derived(receipt ? [...new Set(receipt.payments.map((p) => methodLabel[p.method]))].join(' + ') : '');

	let coverReady = $state(false);
	const ready = (img: HTMLImageElement) => {
		if (img.complete) coverReady = true;
	};
	// The shop, for the customer to come back to.
	const photos = [
		{ src: '/photos/fachada.webp', w: 621, h: 1120, alt: 'La entrada de Bar Beer: fachada verde con el letrero y la calavera de toro sobre la puerta' },
		{ src: '/photos/silla-barco.webp', w: 618, h: 1121, alt: 'Una silla de barbero de cuero bajo un barco de madera, junto a guitarras colgadas' },
		{ src: '/photos/silla-repisa.webp', w: 720, h: 980, alt: 'Una silla de barbero frente al espejo con bombillos y una repisa de figuras y botellas' }
	];
</script>

<svelte:head>
	<title>{receipt ? `Boleta N.º ${String(receipt.receiptNo).padStart(4, '0')} · ${receipt.shop}` : 'Boleta · Bar Beer'}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<header class="cover">
		<img
			class="photo"
			class:ready={coverReady}
			src="/photos/interior-960.webp"
			srcset="/photos/interior-960.webp 960w, /photos/interior-1600.webp 1600w"
			sizes="(min-width: 520px) 520px, 100vw"
			width="1600"
			height="910"
			alt="Bar Beer por dentro: las sillas de barbero, los espejos con bombillos y la vitrina"
			use:ready
			onload={() => (coverReady = true)}
		/>
		<div class="mark"><BrandMark /></div>
	</header>

	{#if status === 'ok' && receipt}
		<article class="ticket" class:void={receipt.status === 'void'} aria-labelledby="r-title">
			<header>
				<h1 id="r-title" class="fig">Boleta N.º {String(receipt.receiptNo).padStart(4, '0')}</h1>
				<p>{receipt.shop} · {day} · <span class="nw">{time}</span></p>
			</header>

			<ul>
				{#each receipt.lines as l, i (i)}
					<li>
						<span class="what">
							{l.name}{l.qty > 1 ? ` × ${l.qty}` : ''}
							{#if l.barber}<em>Te atendió {l.barber}</em>{/if}
						</span>
						<span class="fig">{amount(l.total)}</span>
					</li>
				{/each}
			</ul>

			<p class="total">
				<span class="label">Total</span>
				{#if receipt.status === 'void'}<span class="stamp">ANULADA</span>{/if}
				<span class="fig">{money(receipt.total)}</span>
			</p>
			<p class="paid">Pagado con {methods.toLowerCase()}</p>

			{#if receipt.status === 'void'}
				<p class="voidnote">Esta cuenta fue anulada en el local. Si tienes dudas, pregunta en caja.</p>
			{/if}
		</article>

		<div class="thanks">
			<Mug count={1} goal={1} />
			<p class="fig">{receipt.customer ? `Gracias, ${receipt.customer}` : 'Gracias por venir'}</p>
		</div>

		<section class="again" aria-labelledby="again-title">
			<h2 id="again-title" class="fig">Vuelve pronto</h2>
			<!-- A scrolling row must take keyboard focus so it can be scrolled without a pointer. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<ul class="strip" aria-label="Fotos del local" tabindex="0">
				{#each photos as p (p.src)}
					<li><img src={p.src} width={p.w} height={p.h} alt={p.alt} loading="lazy" decoding="async" /></li>
				{/each}
			</ul>
		</section>
		<p class="legal">Comprobante de pago. No es una factura electrónica.</p>
	{:else if status === 'loading'}
		<div class="sk" aria-busy="true" aria-label="Cargando la boleta"></div>
	{:else if status === 'missing'}
		<section class="empty">
			<h1 class="fig">Boleta no encontrada</h1>
			<p>El enlace está incompleto o la boleta no existe. Ábrelo de nuevo desde el mensaje de WhatsApp.</p>
		</section>
	{:else}
		<section class="empty">
			<h1 class="fig">Sin conexión</h1>
			<p>No pudimos cargar la boleta. Revisa tu internet e intenta de nuevo.</p>
		</section>
	{/if}
</main>

<style>
	main {
		min-height: 100dvh;
		padding: 0 var(--gutter) calc(32px + var(--safe-bottom));
	}
	/* The shop at the top of the receipt, fading into the counter the ticket lies on. */
	.cover {
		position: relative;
		height: 236px;
		margin: 0 calc(-1 * var(--gutter)) 18px;
		overflow: hidden;
		background: var(--wood);
	}
	.photo {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 46% 40%;
		opacity: 0;
		transition: opacity var(--t-move) var(--ease-out);
	}
	.photo.ready {
		opacity: 1;
	}
	.cover::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 60% 55% at 50% 84%, rgb(12 9 6 / 0.55), transparent 70%),
			linear-gradient(to bottom, rgb(12 9 6 / 0.25) 0%, rgb(12 9 6 / 0.1) 30%, rgb(12 9 6 / 0.65) 62%, rgb(12 9 6 / 0.9) 86%, var(--bg) 100%);
	}
	.mark {
		position: absolute;
		z-index: 1;
		inset: auto 0 10px;
		display: flex;
		justify-content: center;
	}
	@media (prefers-reduced-motion: reduce) {
		.photo {
			transition: none;
		}
	}
	.ticket {
		position: relative;
		padding: 18px 16px 16px;
		background: var(--wood);
		border: 1px solid var(--line);
		border-top: 3px solid var(--amber);
		border-radius: 0;
	}
	.ticket header {
		padding-bottom: 12px;
		border-bottom: 1px dashed var(--line-strong);
	}
	h1 {
		font-size: var(--fs-fig-md);
	}
	.ticket header p {
		margin-top: 4px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.ticket ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ticket li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 6px 0;
		border-bottom: 1px dashed var(--line);
	}
	.what {
		display: grid;
		gap: 2px;
		font-size: var(--fs-md);
	}
	.what em {
		font-style: normal;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.ticket li .fig {
		font-size: var(--fs-fig-sm);
	}
	.total {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 14px;
	}
	.total .fig {
		font-size: var(--fs-fig-lg);
		font-weight: 900;
	}
	.paid {
		margin-top: 4px;
		text-align: right;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.void .total .fig,
	.void li .fig {
		text-decoration: line-through;
		color: var(--foam-dim);
	}
	.nw {
		white-space: nowrap;
	}
	/* Same stamp grammar as META: filled logo red, white Chakra Petch 700, tilted 8°. */
	.stamp {
		margin-right: auto;
		margin-left: 12px;
		padding: 2px 8px;
		background: var(--red);
		color: #fff;
		font: 700 var(--fs-sm) / 1.4 var(--font-ui);
		letter-spacing: 0.14em;
		transform: rotate(8deg);
	}
	.voidnote {
		margin-top: 12px;
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	.thanks {
		display: grid;
		justify-items: center;
		gap: 10px;
		margin-top: 32px;
	}
	.thanks :global(.mug) {
		transform: translateX(-6px);
	}
	.thanks .fig {
		font-size: var(--fs-fig-md);
	}
	.again {
		margin: 36px calc(-1 * var(--gutter)) 0;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.again h2 {
		padding: 0 var(--gutter);
		font-size: var(--fs-fig-sm);
	}
	/* Portrait photos side by side; the next one peeks in so the row reads as swipeable. */
	.strip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 62%;
		gap: 8px;
		margin: 10px 0 0;
		padding: 0 var(--gutter) 6px;
		list-style: none;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding: 0 var(--gutter);
		scrollbar-width: thin;
		scrollbar-color: var(--line-strong) transparent;
	}
	.strip:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	.strip li {
		scroll-snap-align: start;
	}
	.strip img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 9 / 14;
		object-fit: cover;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--wood);
	}
	.legal {
		margin-top: 18px;
		text-align: center;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.sk {
		height: 360px;
		border-radius: var(--r);
		background: var(--wood);
	}
	.empty {
		padding: 20px 16px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r);
	}
	.empty p {
		margin-top: 8px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 40ch;
	}
</style>
