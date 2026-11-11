<script lang="ts">
	import FirstSteps from '#lib/components/FirstSteps.svelte';
	import Lineup from '#lib/components/Lineup.svelte';
	import { amount, money } from '#lib/format.js';
	import { live, once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';

	const board = live(() => backend.dayBoard());
	const totals = live(() => backend.dayTotals());
	const t = $derived(totals.data);
	const setup = once(async () => {
		const [staff, items] = await Promise.all([backend.staff(), backend.catalogAll()]);
		return { staff, items };
	});
	// Until barbers, catalog and logins exist the register cannot work: keep the steps in front.
	const fresh = $derived(
		!!setup.data &&
			(!setup.data.items.length ||
				!setup.data.staff.some((s) => s.cuts && s.active) ||
				!setup.data.staff.some((s) => s.role !== 'admin' && s.hasAccess))
	);
	const ranked = $derived(board.data ? [...board.data].sort((a, b) => b.cuts - a.cuts) : []);
</script>

<svelte:head><title>En vivo · Bar Beer</title></svelte:head>

{#if fresh && setup.data}
	<FirstSteps staff={setup.data.staff} items={setup.data.items} />
{/if}

<section class="today" aria-label="Hoy en el local">
	<div class="main">
		<span class="label">Hoy en el local <span class="dot" aria-hidden="true"></span><span class="sr-only">en vivo</span></span>
		<span class="fig total">{t ? money(t.total) : '—'}</span>
	</div>
	<div class="side">
		<span class="fig cuts">{t ? t.cuts : '—'}</span>
		<span class="label">cortes</span>
	</div>
</section>

{#if board.data?.length || !fresh}
	<section class="block">
		<h2 class="fig">La barra</h2>
		{#if board.data?.length}
			<Lineup rows={board.data} />
		{:else if board.data}
			<p class="facts">Sin barberos todavía. Créalos en Equipo.</p>
		{:else if board.error}
			<p class="facts err">{board.error}</p>
		{/if}
	</section>
{/if}

{#if t}
	<dl class="money">
		<div><dt>Efectivo</dt><dd class="fig">{amount(t.cash)}</dd></div>
		<div><dt>Transferencia</dt><dd class="fig">{amount(t.transfer)}</dd></div>
		<div><dt>Tarjeta</dt><dd class="fig">{amount(t.card)}</dd></div>
	</dl>
	<p class="facts">
		{t.bills} {t.bills === 1 ? 'cuenta cobrada' : 'cuentas cobradas'}{#if t.voided}{' · '}<span class="void">{t.voided} {t.voided === 1 ? 'anulada' : 'anuladas'}</span>{/if}
	</p>
{:else if totals.error}
	<p class="facts err">{totals.error}</p>
{/if}

{#if ranked.length}
	<section class="block">
		<h2 class="fig">Barberos hoy</h2>
		<table>
			<thead>
				<tr><th scope="col">Barbero</th><th scope="col">Cortes</th><th scope="col">Vendido</th><th scope="col">Comisión</th></tr>
			</thead>
			<tbody>
				{#each ranked as r (r.staffId)}
					<tr>
						<th scope="row">{r.name}</th>
						<td class="fig" class:met={r.cuts >= r.goal}>{r.cuts}</td>
						<td class="fig">{amount(r.revenue)}</td>
						<td class="fig">{amount(r.commission)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<style>
	.today {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 4px var(--gutter) 14px;
		border-bottom: 1px solid var(--line);
	}
	.main,
	.side {
		display: grid;
		gap: 4px;
	}
	.side {
		text-align: right;
	}
	.total {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
	}
	.cuts {
		font-size: var(--fs-fig-lg);
		color: var(--amber);
	}
	.dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-left: 6px;
		border-radius: 50%;
		background: var(--red);
		vertical-align: 1px;
		animation: pulse 2.4s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
	.block {
		padding: 20px 12px 0;
	}
	.block > h2 {
		padding: 0 4px 10px;
		font-size: 1.25rem;
	}
	.money {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin: 16px var(--gutter) 0;
		padding: 10px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.money dt {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.money dd {
		margin: 2px 0 0;
		font-size: var(--fs-fig-sm);
		font-weight: 900;
		white-space: nowrap;
	}
	.facts {
		padding: 10px var(--gutter) 0;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.void,
	.err {
		color: var(--danger-text);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th,
	td {
		height: 42px;
		padding: 0 4px;
		border-bottom: 1px solid var(--line);
		text-align: right;
	}
	thead th {
		height: 30px;
		font-size: var(--fs-xs);
		font-weight: 500;
		color: var(--foam-dim);
		border-bottom-color: var(--line-strong);
	}
	th:first-child {
		text-align: left;
	}
	tbody th {
		font-weight: 700;
	}
	td.fig {
		font-size: var(--fs-fig-sm);
	}
	td.met {
		color: var(--amber);
	}
</style>
