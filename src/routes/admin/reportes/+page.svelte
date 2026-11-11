<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import { downloadCsv, toCsv } from '#lib/csv.js';
	import { amount, clock, dayLabel, methodLabel, money, periodRange, type PeriodKind } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type ItemKind, type ReportSummary } from '#lib/types.js';

	const today = once(() => backend.businessDate());
	let kind = $state<PeriodKind>('month');
	let offset = $state(0);
	const range = $derived(today.data ? periodRange(today.data, kind, offset) : null);

	let report = $state<ReportSummary | null>(null);
	let error = $state('');
	let exporting = $state(false);
	let csvMsg = $state('');

	$effect(() => {
		const r = range;
		if (!r) return;
		report = null;
		error = '';
		csvMsg = '';
		backend
			.reportSummary(r.from, r.to)
			.then((d) => {
				if (range === r) report = d;
			})
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudo cargar el reporte.'));
	});

	const kinds: { kind: ItemKind; label: string }[] = [
		{ kind: 'service', label: 'Servicios' },
		{ kind: 'drink', label: 'Bebidas' },
		{ kind: 'product', label: 'Productos' }
	];
	const kindLabel: Record<ItemKind, string> = { service: 'Servicio', drink: 'Bebida', product: 'Producto' };
	const maxDay = $derived(Math.max(1, ...(report?.byDay ?? []).map((d) => d.total)));

	const methodWords = (p: string | null) =>
		(p ?? '').replace(/\b(cash|transfer|card)\b/g, (m) => methodLabel[m as keyof typeof methodLabel]);

	async function exportCsv() {
		if (!range) return;
		exporting = true;
		csvMsg = '';
		try {
			const lines = await backend.reportLines(range.from, range.to);
			if (!lines.length) {
				csvMsg = 'No hay ventas en este periodo.';
				return;
			}
			const csv = toCsv(
				['Fecha', 'Boleta', 'Hora', 'Ítem', 'Tipo', 'Cantidad', 'Total', 'Barbero', 'Comisión', 'Estado', 'Pago', 'Cliente'],
				lines.map((l) => [
					l.date,
					l.receiptNo,
					clock(l.createdAt),
					l.item,
					kindLabel[l.kind],
					l.qty,
					l.total,
					l.barber,
					l.commission,
					l.status === 'void' ? 'Anulada' : 'Cobrada',
					methodWords(l.payment),
					l.customer
				])
			);
			downloadCsv(`bar-beer-${range.from}${range.from === range.to ? '' : `_${range.to}`}.csv`, csv);
			csvMsg = `Descargado: ${amount(lines.length)} ${lines.length === 1 ? 'línea' : 'líneas'}.`;
		} catch (e) {
			csvMsg = e instanceof AppError ? e.message : 'No se pudo preparar el CSV.';
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head><title>Reportes · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Reportes</h1>

	{#if today.data}
		<RangePicker today={today.data} bind:kind bind:offset />
	{/if}

	{#if error}
		<p class="err">{error}</p>
	{:else if report}
		{#if !report.bills && !report.voided}
			<EmptyState flush title="Sin ventas en este periodo">
				<p>Elige otro periodo con las flechas, o vuelve cuando la caja haya cobrado.</p>
			</EmptyState>
		{:else}
			<div class="total">
				<span class="label">Vendido</span>
				<span class="fig big">{money(report.total)}</span>
				<span class="dim">
					{amount(report.bills)} {report.bills === 1 ? 'cuenta' : 'cuentas'}
					{#if report.bills}· promedio {money(Math.round(report.total / report.bills))}{/if}
					{#if report.voided}· {report.voided} {report.voided === 1 ? 'anulada' : 'anuladas'}{/if}
				</span>
			</div>

			<dl class="strip">
				<div><dt class="label">Efectivo</dt><dd class="fig">{amount(report.methods.cash)}</dd></div>
				<div><dt class="label">Transferencia</dt><dd class="fig">{amount(report.methods.transfer)}</dd></div>
				<div><dt class="label">Tarjeta</dt><dd class="fig">{amount(report.methods.card)}</dd></div>
			</dl>
			<dl class="strip two">
				<div><dt class="label">Cortes</dt><dd class="fig">{amount(report.cuts)}</dd></div>
				<div><dt class="label">Comisiones</dt><dd class="fig earn">{amount(report.commission)}</dd></div>
			</dl>
			<p class="note">Comisiones de lo vendido, sin bonos. Los bonos y lo pagado están en Pagos a barberos.</p>

			<button type="button" class="btn btn-outline csv" onclick={exportCsv} disabled={exporting}>
				<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
				{exporting ? 'Preparando…' : 'Descargar CSV'}
			</button>
			<p class="form-msg" role="status">{csvMsg}</p>

			{#if report.byBarber.length}
				<h2 class="fig heading">Por barbero</h2>
				<div class="cols b" aria-hidden="true"><span></span><span class="label">Vendido</span><span class="label">Comisión</span></div>
				<ul class="rows">
					{#each report.byBarber as b (b.name)}
						<li class="b">
							<span class="n">{b.name}<small>{amount(b.cuts)} {b.cuts === 1 ? 'corte' : 'cortes'}</small></span>
							<span class="fig">{amount(b.revenue)}</span>
							<span class="fig earn">{amount(b.commission)}</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#each kinds as k (k.kind)}
				{@const list = report.byItem.filter((i) => i.kind === k.kind)}
				{#if list.length}
					<h2 class="fig heading">{k.label}</h2>
					<ul class="rows">
						{#each list as i (i.name)}
							<li class="i">
								<span class="n">{i.name}</span>
								<span class="q">× {amount(i.qty)}</span>
								<span class="fig">{amount(i.revenue)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/each}

			{#if report.byDay.length > 1}
				<h2 class="fig heading">Por día</h2>
				<ul class="rows">
					{#each report.byDay as d (d.date)}
						<li class="d">
							<span class="n">{dayLabel(d.date)}<small>{d.bills} {d.bills === 1 ? 'cuenta' : 'cuentas'}</small></span>
							<span class="bar" aria-hidden="true"><span style:width="{(d.total / maxDay) * 100}%"></span></span>
							<span class="fig">{amount(d.total)}</span>
						</li>
					{/each}
				</ul>
				<p class="legend">La barra compara cada día con el mejor del periodo.</p>
			{/if}
		{/if}
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
	.total {
		display: grid;
		gap: 2px;
		padding-bottom: 12px;
	}
	.big {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
		line-height: 1;
	}
	.dim {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin: 0;
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.strip.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-bottom: 1px solid var(--line);
	}
	.strip dd {
		margin: 2px 0 0;
		font-size: var(--fs-fig-sm);
		font-weight: 900;
		white-space: nowrap;
	}
	.earn {
		color: var(--amber);
	}
	.note,
	.legend {
		margin-top: 8px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.csv {
		width: 100%;
		margin-top: 16px;
	}
	.csv .chev {
		width: 18px;
		height: 18px;
	}
	.form-msg {
		margin-top: 6px;
	}
	.heading {
		margin: 22px 0 4px;
		font-size: 1.25rem;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	.rows li {
		display: grid;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		border-bottom: 1px solid var(--line);
	}
	.b {
		grid-template-columns: 1fr 6.5rem 5.5rem;
	}
	.cols {
		display: grid;
		gap: 10px;
		padding-bottom: 4px;
	}
	.cols .label {
		text-align: right;
	}
	.i {
		grid-template-columns: 1fr auto 6.5rem;
	}
	.d {
		grid-template-columns: 7.5rem 1fr 6.5rem;
	}
	.rows .fig {
		font-size: var(--fs-fig-sm);
		text-align: right;
		white-space: nowrap;
	}
	.n {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.n small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.q {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.bar {
		height: 8px;
		border: 1px solid var(--line);
		border-radius: 2px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--foam-dim);
	}
	.err {
		color: var(--danger-text);
		font-size: var(--fs-sm);
	}
	.sk {
		height: 360px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
