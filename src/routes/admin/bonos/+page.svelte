<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { ruleGoal } from '#lib/bonus.js';
	import { money } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError } from '#lib/types.js';

	const rules = once(() => backend.bonusRules());
	let busy = $state(false);
	let msg = $state<{ ok: boolean; text: string } | null>(null);

	async function award() {
		busy = true;
		msg = null;
		try {
			const n = await backend.awardBonuses();
			msg = {
				ok: true,
				text: n ? `Listo: ${n} ${n === 1 ? 'bono nuevo' : 'bonos nuevos'}. Ya salen en Pagos y en las metas de cada barbero.` : 'Al día: no había bonos pendientes.'
			};
		} catch (e) {
			msg = { ok: false, text: e instanceof AppError ? e.message : 'No se pudieron calcular.' };
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Bonos · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<div class="head">
		<h1 class="fig">Bonos</h1>
		<a class="btn btn-outline" href="/admin/bonos/nuevo">
			<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			Agregar
		</a>
	</div>
	<p class="note">Cada barbero ve sus bonos activos en Metas con su avance. Cuando cierra el día, la semana o el mes, el premio se suma solo a lo que se le paga.</p>

	{#if rules.data}
		{#if rules.data.length}
			<ul>
				{#each rules.data as r (r.id)}
					<li class:off={!r.active}>
						<a href={`/admin/bonos/${r.id}`}>
							<span class="name">
								{r.name}
								<small>{r.active ? ruleGoal(r) : `Pausado · ${ruleGoal(r)}`}</small>
							</span>
							<span class="reward">
								<span class="fig">{r.rewardType === 'fixed' ? money(r.rewardValue) : `+${r.rewardValue} %`}</span>
								<small>{r.rewardType === 'fixed' ? 'de premio' : 'sobre su comisión'}</small>
							</span>
							<svg class="chev go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState flush title="Sin bonos">
				<p>Crea uno con el botón de arriba: por ejemplo, $ 50.000 al que haga 40 cortes en la semana.</p>
			</EmptyState>
		{/if}

		<div class="calc">
			<p class="hint">Los premios se calculan solos cada noche. Si acabas de crear o cambiar un bono y quieres verlo ya, calcula ahora.</p>
			<p class="form-msg" class:ok={msg?.ok} class:err={msg && !msg.ok} role="status">{msg?.text ?? ''}</p>
			<button type="button" class="btn btn-outline" onclick={award} disabled={busy}>
				{busy ? 'Calculando…' : 'Calcular bonos pendientes'}
			</button>
		</div>
	{:else if rules.error}
		<p class="form-msg err">{rules.error}</p>
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.note,
	.hint {
		margin: 6px 0 12px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	li {
		border-bottom: 1px solid var(--line);
	}
	a:not(.btn):not(.back-link) {
		display: grid;
		grid-template-columns: 1fr auto 20px;
		align-items: center;
		gap: 10px;
		min-height: 60px;
		padding: 6px 0;
		color: inherit;
		text-decoration: none;
	}
	.name {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.name small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.reward {
		display: grid;
		justify-items: end;
	}
	.reward .fig {
		font-size: var(--fs-fig-sm);
		color: var(--amber);
		white-space: nowrap;
	}
	.reward small {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.go {
		color: var(--foam-dim);
	}
	.off .name {
		color: var(--foam-dim);
	}
	.off .reward .fig {
		color: var(--foam-dim);
		text-decoration: line-through;
	}
	.calc {
		display: grid;
		gap: 8px;
		margin-top: 20px;
	}
	.sk {
		height: 240px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
