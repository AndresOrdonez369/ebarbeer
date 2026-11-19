<!-- Every bill of any day, for the owner to check and void one charged by mistake. -->
<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import SalesList from '#lib/components/SalesList.svelte';
	import { money, periodRange, type PeriodKind } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type SaleRecord } from '#lib/types.js';

	const today = once(() => backend.businessDate());
	const staff = once(() => backend.staff());
	let kind = $state<PeriodKind>('day');
	let offset = $state(0);
	const day = $derived(today.data ? periodRange(today.data, 'day', offset).from : null);

	let rows = $state<SaleRecord[] | null>(null);
	let error = $state('');

	function load(d: string) {
		error = '';
		backend
			.daySales(d)
			.then((r) => {
				if (day === d) rows = r;
			})
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudieron cargar las cuentas.'));
	}
	$effect(() => {
		if (!day) return;
		rows = null;
		load(day);
	});

	const names = $derived(new Map((staff.data ?? []).map((s) => [s.id, s.name])));
	const ok = $derived((rows ?? []).filter((s) => s.status === 'ok'));
	const voided = $derived((rows ?? []).length - ok.length);
	const total = $derived(ok.reduce((s, r) => s + r.total, 0));
</script>

<svelte:head><title>Cuentas · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Cuentas</h1>
	<p class="dim intro">Todo lo cobrado en el día. Toca una cuenta para ver el detalle o anularla si se cobró dos veces o por error.</p>

	{#if today.data}
		<RangePicker today={today.data} bind:kind bind:offset kinds={['day']} />
	{/if}

	{#if error}
		<p class="form-msg err">{error}</p>
	{:else if rows}
		{#if !rows.length}
			<EmptyState flush title="Sin cuentas">
				<p>Ese día no se cobró ninguna cuenta.</p>
			</EmptyState>
		{:else}
			<p class="sum">
				<span class="fig">{money(total)}</span>
				<span class="dim">{ok.length} {ok.length === 1 ? 'cuenta' : 'cuentas'}{voided ? ` · ${voided} ${voided === 1 ? 'anulada' : 'anuladas'}` : ''}</span>
			</p>
			<SalesList list={rows} {names} receipts={false} onvoided={() => day && load(day)} />
		{/if}
	{:else}
		<p class="dim">Cargando…</p>
	{/if}
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.intro {
		margin: 2px 0 10px;
		max-width: 50ch;
	}
	.sum {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--line);
	}
	.sum .fig {
		font-size: var(--fs-fig-md);
	}
	.dim {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
</style>
