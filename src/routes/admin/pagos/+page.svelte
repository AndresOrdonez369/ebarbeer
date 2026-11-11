<script lang="ts">
	import { page } from '$app/state';
	import PayoutList from '#lib/components/PayoutList.svelte';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import { periodLabel, periodRange, type PeriodKind } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type PayoutRow } from '#lib/types.js';

	const today = once(() => backend.businessDate());
	const k0 = page.url.searchParams.get('k');
	let kind = $state<PeriodKind>(k0 === 'day' || k0 === 'month' ? k0 : 'week');
	let offset = $state(Math.min(0, Number(page.url.searchParams.get('o')) || 0));
	const range = $derived(today.data ? periodRange(today.data, kind, offset) : null);

	let rows = $state<PayoutRow[] | null>(null);
	let error = $state('');

	$effect(() => {
		const r = range;
		if (!r) return;
		rows = null;
		error = '';
		backend
			.payoutSummary(r.from, r.to)
			.then((d) => {
				if (range === r) rows = d;
			})
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudieron cargar los pagos.'));
	});

	const when = $derived(range ? (kind === 'day' && offset === 0 ? 'hoy' : `en ${periodLabel(kind, offset, range).split(' · ')[0].toLowerCase()}`) : '');
</script>

<svelte:head><title>Pagos a barberos · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Pagos</h1>
	<p class="note">Lo ganado (comisión más bonos), lo ya pagado y lo que falta. La caja también paga desde su pestaña Barberos.</p>

	{#if today.data}
		<RangePicker today={today.data} bind:kind bind:offset />
	{/if}

	{#if error}
		<p class="form-msg err">{error}</p>
	{:else if rows}
		<PayoutList {rows} {when} href={(r) => `/admin/pagos/${r.staffId}?k=${kind}&o=${offset}`} />
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.note {
		margin: 4px 0 0;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.sk {
		height: 320px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
