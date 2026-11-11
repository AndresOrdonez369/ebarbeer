<!-- Add or edit a bonus rule. -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { parsePesos } from '#lib/bill.js';
	import { periodName, ruleGoal, ruleReward } from '#lib/bonus.js';
	import { amount } from '#lib/format.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type BonusRule, type Period } from '#lib/types.js';

	const isNew = $derived(page.params.id === 'nuevo');

	let rule = $state<BonusRule | null>(null);
	let loaded = $state(false);
	let missing = $state(false);

	let name = $state('');
	let period = $state<Period>('week');
	let metric = $state<BonusRule['metric']>('cuts');
	let thresholdText = $state('');
	let rewardType = $state<BonusRule['rewardType']>('fixed');
	let rewardText = $state('');
	let active = $state(true);
	let busy = $state(false);
	let msg = $state<{ ok: boolean; text: string } | null>(null);

	onMount(async () => {
		if (!isNew) {
			try {
				const r = (await backend.bonusRules()).find((x) => x.id === page.params.id);
				if (!r) missing = true;
				else fill(r);
			} catch (e) {
				msg = { ok: false, text: e instanceof AppError ? e.message : 'No se pudo cargar.' };
			}
		}
		loaded = true;
	});

	function fill(r: BonusRule) {
		rule = r;
		name = r.name;
		period = r.period;
		metric = r.metric;
		thresholdText = amount(r.threshold);
		rewardType = r.rewardType;
		rewardText = r.rewardType === 'fixed' ? amount(r.rewardValue) : String(r.rewardValue);
		active = r.active;
	}

	const threshold = $derived(parsePesos(thresholdText));
	const reward = $derived(rewardType === 'fixed' ? parsePesos(rewardText) : Number(rewardText.replace(',', '.')) || 0);
	const preview = $derived(
		threshold && reward ? `${ruleGoal({ period, metric, threshold })}: ${ruleReward({ rewardType, rewardValue: reward })}.` : ''
	);

	const whole = (set: (v: string) => void) => (e: Event & { currentTarget: HTMLInputElement }) => {
		const v = e.currentTarget.value;
		set(/[0-9]/.test(v) ? amount(parsePesos(v)) : '');
	};

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = null;
		if (!name.trim()) return (msg = { ok: false, text: 'Escribe el nombre del bono.' });
		if (!threshold) return (msg = { ok: false, text: metric === 'cuts' ? 'Escribe cuántos cortes.' : 'Escribe la meta de ventas.' });
		if (!reward) return (msg = { ok: false, text: 'Escribe el premio.' });
		if (rewardType === 'pct_extra' && reward > 100) return (msg = { ok: false, text: 'El porcentaje va de 1 a 100.' });
		busy = true;
		try {
			const saved = await backend.saveBonusRule({
				id: rule?.id,
				name,
				period,
				metric,
				threshold,
				rewardType,
				rewardValue: reward,
				active
			});
			if (isNew) {
				await goto(`/admin/bonos/${saved.id}`, { replaceState: true });
				msg = { ok: true, text: 'Creado. Los barberos ya lo ven en Metas.' };
			} else {
				msg = { ok: true, text: active ? 'Guardado. Cuenta desde el periodo que está corriendo.' : 'Guardado y pausado. Lo ya ganado se conserva.' };
			}
			fill(saved);
		} catch (err) {
			msg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo guardar.' };
		} finally {
			busy = false;
		}
	}

	const periods: Period[] = ['day', 'week', 'month'];
</script>

<svelte:head><title>{isNew ? 'Nuevo bono' : (rule?.name ?? 'Bono')} · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/bonos">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Bonos
	</a>

	{#if missing}
		<h1 class="fig">No encontrado</h1>
	{:else if loaded}
		<h1 class="fig">{isNew ? 'Nuevo bono' : rule?.name}</h1>

		<form class="form block" onsubmit={save} novalidate>
			<label class="field">
				<span class="label">Nombre</span>
				<input class="input" bind:value={name} autocomplete="off" autocapitalize="sentences" placeholder="Semana fuerte" maxlength="40" />
				<span class="hint">Así lo ve el barbero en sus metas.</span>
			</label>

			<div class="field">
				<span class="label" id="period-label">Cada</span>
				<div class="choice" role="radiogroup" aria-labelledby="period-label">
					{#each periods as p (p)}
						<button type="button" role="radio" aria-checked={period === p} onclick={() => (period = p)}>{periodName[p]}</button>
					{/each}
				</div>
			</div>

			<div class="field">
				<span class="label" id="metric-label">Se mide por</span>
				<div class="choice" role="radiogroup" aria-labelledby="metric-label" style:--n="2">
					<button type="button" role="radio" aria-checked={metric === 'cuts'} onclick={() => (metric = 'cuts')}>Cortes</button>
					<button type="button" role="radio" aria-checked={metric === 'revenue'} onclick={() => (metric = 'revenue')}>Ventas</button>
				</div>
			</div>

			<label class="field">
				<span class="label">{metric === 'cuts' ? 'Cortes para ganarlo' : 'Ventas para ganarlo'}</span>
				<input class="input amt" inputmode="numeric" value={thresholdText} oninput={whole((v) => (thresholdText = v))} placeholder={metric === 'cuts' ? '40' : '3.500.000'} />
				<span class="hint">{metric === 'cuts' ? 'Solo suman los servicios marcados como corte.' : 'Todo lo que la caja le asigna a ese barbero.'}</span>
			</label>

			<div class="field">
				<span class="label" id="reward-label">Premio</span>
				<div class="choice" role="radiogroup" aria-labelledby="reward-label" style:--n="2">
					<button type="button" role="radio" aria-checked={rewardType === 'fixed'} onclick={() => ((rewardType = 'fixed'), (rewardText = ''))}>Monto fijo</button>
					<button type="button" role="radio" aria-checked={rewardType === 'pct_extra'} onclick={() => ((rewardType = 'pct_extra'), (rewardText = ''))}>% de su comisión</button>
				</div>
			</div>

			<label class="field">
				<span class="label">{rewardType === 'fixed' ? 'Monto' : 'Porcentaje extra'}</span>
				{#if rewardType === 'fixed'}
					<input class="input amt" inputmode="numeric" value={rewardText} oninput={whole((v) => (rewardText = v))} placeholder="50.000" />
				{:else}
					<input class="input amt" inputmode="decimal" bind:value={rewardText} placeholder="5" />
					<span class="hint">Sobre la comisión que ganó en ese periodo. Con 5, quien ganó $ 1.000.000 recibe $ 50.000 más.</span>
				{/if}
			</label>

			{#if !isNew}
				<label class="check">
					<input type="checkbox" bind:checked={active} />
					<span>Activo<small>Pausado deja de contar; lo ya ganado se conserva</small></span>
				</label>
			{/if}

			<p class="preview" aria-live="polite">{preview}</p>
			<p class="form-msg" class:ok={msg?.ok} class:err={msg && !msg.ok} role="status">{msg?.text ?? ''}</p>
			<button class="btn btn-foam" type="submit" disabled={busy}>{busy ? 'Guardando…' : isNew ? 'Crear bono' : 'Guardar'}</button>
		</form>
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
	.block {
		margin-top: 14px;
	}
	.amt {
		text-align: right;
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
	}
	.preview {
		min-height: 1.2em;
		font-size: var(--fs-sm);
		color: var(--foam);
		max-width: 46ch;
	}
	.preview:first-letter {
		text-transform: uppercase;
	}
	.sk {
		height: 420px;
		margin-top: 16px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
