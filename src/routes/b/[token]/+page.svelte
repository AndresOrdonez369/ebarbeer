<!-- The customer's receipt, opened from the WhatsApp link. Public, no account, no phone shown. -->
<script lang="ts">
	import { page } from '$app/state';
	import Mug from '#lib/components/Mug.svelte';
	import Plate from '#lib/components/Plate.svelte';
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
</script>

<svelte:head>
	<title>{receipt ? `Boleta N.º ${String(receipt.receiptNo).padStart(4, '0')} · ${receipt.shop}` : 'Boleta · Bar Beer'}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<div class="brand"><Plate size="lg" /></div>

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
		padding: 28px var(--gutter) calc(32px + var(--safe-bottom));
	}
	.brand {
		display: flex;
		justify-content: center;
		margin-bottom: 24px;
	}
	.ticket {
		position: relative;
		padding: 18px 16px 16px;
		background: var(--wood);
		border: 1px solid var(--line);
		border-top: 3px solid var(--amber);
		border-radius: 0;
	}
	header {
		padding-bottom: 12px;
		border-bottom: 1px dashed var(--line-strong);
	}
	h1 {
		font-size: var(--fs-fig-md);
	}
	header p {
		margin-top: 4px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
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
	li .fig {
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
	.legal {
		margin-top: 10px;
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
