<!-- One person: their data, their login (user + PIN) and their special percentages. -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { longDate, toIsoDate } from '#lib/format.js';
	import { backend, session } from '#lib/session.svelte.js';
	import { AppError, type CatalogItem, type Role, type StaffMember } from '#lib/types.js';

	const isNew = $derived(page.params.id === 'nuevo');

	let member = $state<StaffMember | null>(null);
	let loaded = $state(false);
	let missing = $state(false);
	let shopGoal = $state(8);

	// Data form
	let name = $state('');
	let role = $state<Role>('barber');
	let cuts = $state(true);
	let goalText = $state('');
	let hiredOn = $state(toIsoDate(new Date()));
	let active = $state(true);
	let saving = $state(false);
	let dataMsg = $state<{ ok: boolean; text: string } | null>(null);

	// Access form
	let username = $state('');
	let pin = $state('');
	let accessBusy = $state(false);
	let confirmRevoke = $state(false);
	const isMe = $derived(!!member && member.id === session.profile?.staffId);
	let accessMsg = $state<{ ok: boolean; text: string } | null>(null);

	// Percentages
	let services = $state<CatalogItem[]>([]);
	let pct = $state<Record<string, string>>({});
	let pctSaved = $state<Record<string, string>>({});
	let pctBusy = $state(false);
	let pctMsg = $state<{ ok: boolean; text: string } | null>(null);

	const slug = (s: string) =>
		s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '.')
			.replace(/^\.|\.$/g, '')
			.slice(0, 30);

	onMount(async () => {
		try {
			const [team, settings, catalog] = await Promise.all([backend.staff(), backend.shopSettings(), backend.catalogAll()]);
			shopGoal = settings.dailyCutGoal;
			services = catalog.filter((i) => i.kind === 'service' && i.active !== false);
			if (!isNew) {
				const m = team.find((x) => x.id === page.params.id) ?? null;
				if (!m) {
					missing = true;
				} else {
					fill(m);
					await loadOverrides(m.id);
				}
			}
		} catch (e) {
			dataMsg = { ok: false, text: e instanceof AppError ? e.message : 'No se pudo cargar.' };
		}
		loaded = true;
	});

	function fill(m: StaffMember) {
		member = m;
		name = m.name;
		role = m.role;
		cuts = m.cuts;
		goalText = m.dailyCutGoal ? String(m.dailyCutGoal) : '';
		hiredOn = m.hiredOn;
		active = m.active;
		username = m.username ?? slug(m.name);
	}

	async function loadOverrides(id: string) {
		const list = await backend.overrides(id);
		const map: Record<string, string> = {};
		for (const o of list) map[o.itemId] = String(o.pct);
		pct = { ...map };
		pctSaved = { ...map };
	}

	async function saveData(e: SubmitEvent) {
		e.preventDefault();
		dataMsg = null;
		const goal = goalText.trim() ? Number(goalText) : null;
		if (!name.trim()) return (dataMsg = { ok: false, text: 'Escribe el nombre.' });
		if (goal != null && (!Number.isInteger(goal) || goal < 1 || goal > 200))
			return (dataMsg = { ok: false, text: 'La meta diaria va de 1 a 200 cortes, o déjala vacía.' });
		saving = true;
		try {
			const saved = await backend.saveStaff({
				id: member?.id,
				role,
				name,
				cuts: role === 'barber' ? true : cuts,
				dailyCutGoal: goal,
				hiredOn,
				active
			});
			if (isNew) {
				await goto(`/admin/equipo/${saved.id}`, { replaceState: true });
				fill(saved);
				dataMsg = { ok: true, text: 'Persona creada. Ya aparece en la caja si atiende clientes.' };
			} else {
				fill(saved);
				dataMsg = { ok: true, text: 'Guardado.' };
			}
		} catch (err) {
			dataMsg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo guardar.' };
		} finally {
			saving = false;
		}
	}

	async function access(action: 'grant' | 'password' | 'revoke') {
		if (!member) return;
		accessMsg = null;
		if (action === 'grant' && !/^[a-z0-9._-]{2,30}$/.test(username.trim().toLowerCase()))
			return (accessMsg = { ok: false, text: 'Usuario: 2 a 30 letras minúsculas, números, punto o guion, sin espacios.' });
		if (action !== 'revoke' && pin.length < 6)
			return (accessMsg = { ok: false, text: 'El PIN debe tener al menos 6 caracteres (números o letras).' });
		if (action === 'revoke' && isMe)
			return (accessMsg = { ok: false, text: 'No puedes quitarte tu propio acceso. Pídeselo a otro administrador.' });
		confirmRevoke = false;
		accessBusy = true;
		try {
			await backend.staffAccess(member.id, action, username, pin);
			const team = await backend.staff();
			const m = team.find((x) => x.id === member!.id);
			if (m) fill(m);
			pin = '';
			accessMsg = {
				ok: true,
				text:
					action === 'grant'
						? `Listo. ${member.name} entra con el usuario «${member.username}» y el PIN que escribiste.`
						: action === 'password'
							? 'PIN cambiado. Díselo en persona.'
							: 'Acceso quitado. Su historial se conserva.'
			};
		} catch (err) {
			accessMsg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo cambiar el acceso.' };
		} finally {
			accessBusy = false;
		}
	}

	async function savePct() {
		if (!member) return;
		pctMsg = null;
		const changed = services.filter((s) => (pct[s.id] ?? '') !== (pctSaved[s.id] ?? ''));
		for (const s of changed) {
			const v = (pct[s.id] ?? '').trim();
			if (v && !(Number(v) >= 0 && Number(v) <= 100))
				return (pctMsg = { ok: false, text: `${s.name}: el porcentaje va de 0 a 100.` });
		}
		pctBusy = true;
		try {
			for (const s of changed) {
				const v = (pct[s.id] ?? '').trim();
				await backend.saveOverride(member.id, s.id, v ? Number(v) : null);
			}
			await loadOverrides(member.id);
			pctMsg = { ok: true, text: changed.length ? 'Porcentajes guardados. Aplican desde el próximo cobro.' : 'Sin cambios.' };
		} catch (err) {
			pctMsg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo guardar.' };
		} finally {
			pctBusy = false;
		}
	}
</script>

<svelte:head><title>{isNew ? 'Nueva persona' : (member?.name ?? 'Persona')} · Equipo · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/equipo">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Equipo
	</a>

	{#if missing}
		<h1 class="fig">No encontrada</h1>
		<p class="note">Esa persona no existe en este local.</p>
	{:else if loaded}
		<h1 class="fig">{isNew ? 'Nueva persona' : member?.name}</h1>

		<form class="form block" onsubmit={saveData} novalidate>
			<h2 class="fig heading">Datos</h2>
			<label class="field">
				<span class="label">Nombre o apodo</span>
				<input class="input" bind:value={name} autocomplete="off" autocapitalize="words" placeholder="Kike" />
				<span class="hint">Es el que se ve en la caja y en la boleta.</span>
			</label>
			<div class="stack2">
				<label class="field">
					<span class="label">Rol</span>
					<!-- Choosing a role resets "atiende clientes" to what that role usually does. -->
					<select class="input" bind:value={role} onchange={(e) => (cuts = e.currentTarget.value === 'barber')}>
						<option value="barber">Barbero</option>
						<option value="cashier">Caja</option>
						<option value="admin">Administración</option>
					</select>
				</label>
				<label class="field">
					<span class="label">Ingresó</span>
					<input class="input" type="date" bind:value={hiredOn} />
					<span class="hint">{hiredOn ? longDate(hiredOn) : ''}</span>
				</label>
			</div>
			{#if role !== 'barber'}
				<label class="check">
					<input type="checkbox" bind:checked={cuts} />
					<span>También atiende clientes<small>Aparece en la caja con su jarra</small></span>
				</label>
			{/if}
			{#if role === 'barber' || cuts}
				<label class="field">
					<span class="label">Meta diaria propia (cortes)</span>
					<input class="input" bind:value={goalText} inputmode="numeric" placeholder={`La del local: ${shopGoal}`} />
					<span class="hint">Vacía usa la meta del local. Es hasta donde se llena su jarra.</span>
				</label>
			{/if}
			{#if !isNew}
				<label class="check">
					<input type="checkbox" bind:checked={active} />
					<span>Activo<small>Inactivo sale de la caja y conserva su historial</small></span>
				</label>
			{/if}
			<p class="form-msg" class:ok={dataMsg?.ok} class:err={dataMsg && !dataMsg.ok} role="status">{dataMsg?.text ?? ''}</p>
			<button class="btn btn-foam" type="submit" disabled={saving}>
				{saving ? 'Guardando…' : isNew ? 'Crear persona' : 'Guardar datos'}
			</button>
		</form>

		{#if member}
			<section class="block form">
				<h2 class="fig heading">Acceso</h2>
				{#if member.hasAccess}
					<p class="note">Entra con el usuario <b>{member.username}</b> y su PIN.</p>
					<label class="field">
						<span class="label">Nuevo PIN</span>
						<input class="input" bind:value={pin} type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" />
					</label>
					{#if !confirmRevoke || accessMsg}
						<p class="form-msg" class:ok={accessMsg?.ok} class:err={accessMsg && !accessMsg.ok} role="status">{accessMsg?.text ?? ''}</p>
					{/if}
					{#if confirmRevoke}
						<div class="confirm" role="alertdialog" aria-labelledby="revoke-q">
							<p id="revoke-q">¿Quitar el acceso a {member.name}? No podrá entrar hasta que le des uno nuevo. Su historial se conserva.</p>
							<div class="row2">
								<button class="btn btn-outline" type="button" onclick={() => (confirmRevoke = false)}>Cancelar</button>
								<button class="btn btn-danger" type="button" disabled={accessBusy} onclick={() => access('revoke')}>Sí, quitar acceso</button>
							</div>
						</div>
					{:else}
						<div class="row2">
							<button class="btn btn-outline" type="button" disabled={accessBusy} onclick={() => access('password')}>Cambiar PIN</button>
							<button
								class="btn btn-danger"
								type="button"
								disabled={accessBusy || isMe}
								title={isMe ? 'No puedes quitarte tu propio acceso' : undefined}
								onclick={() => ((confirmRevoke = true), (accessMsg = null))}>Quitar acceso</button
							>
						</div>
						{#if isMe}<p class="hint">Es tu propio acceso: solo otro administrador puede quitarlo.</p>{/if}
					{/if}
				{:else}
					<p class="note">Sin acceso todavía. La caja igual le puede asignar servicios.</p>
					<div class="row2">
						<label class="field">
							<span class="label">Usuario</span>
							<input class="input" bind:value={username} autocapitalize="none" autocomplete="off" spellcheck="false" />
						</label>
						<label class="field">
							<span class="label">PIN</span>
							<input class="input" bind:value={pin} type="password" autocomplete="new-password" placeholder="Mínimo 6" />
						</label>
					</div>
					<p class="form-msg" class:ok={accessMsg?.ok} class:err={accessMsg && !accessMsg.ok} role="status">{accessMsg?.text ?? ''}</p>
					<button class="btn btn-outline" type="button" disabled={accessBusy} onclick={() => access('grant')}>
						{accessBusy ? 'Creando…' : 'Dar acceso'}
					</button>
				{/if}
			</section>

			{#if member.cuts}
				<section class="block">
					<h2 class="fig heading">Porcentajes especiales</h2>
					<p class="note">Con «—» usa el porcentaje general. Escribe uno solo si este barbero gana distinto. Cambiarlo no mueve lo ya cobrado.</p>
					<ul class="pcts">
						{#each services as s (s.id)}
							<li>
								<label for={`pct-${s.id}`}>{s.name}<small>General {s.commissionPct}%</small></label>
								<span class="pctin">
									<input
										id={`pct-${s.id}`}
										class="input"
										inputmode="decimal"
										placeholder="—"
										bind:value={pct[s.id]}
									/>
									<span aria-hidden="true">%</span>
								</span>
							</li>
						{/each}
					</ul>
					<p class="form-msg" class:ok={pctMsg?.ok} class:err={pctMsg && !pctMsg.ok} role="status">{pctMsg?.text ?? ''}</p>
					<button class="btn btn-outline wide" type="button" disabled={pctBusy} onclick={savePct}>
						{pctBusy ? 'Guardando…' : 'Guardar porcentajes'}
					</button>
				</section>
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
	.block {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.heading {
		font-size: 1.25rem;
	}
	.note {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.note b {
		color: var(--foam);
	}
	.pcts {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
	}
	.pcts li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		border-bottom: 1px solid var(--line);
	}
	.pcts label {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.pcts small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.pctin {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--foam-dim);
	}
	.pctin .input {
		width: 5.5rem;
		text-align: right;
	}
	.wide {
		width: 100%;
	}
	/* Rol and Ingresó share a row only when "Administración" fits in the select. */
	.stack2 {
		display: grid;
		gap: 14px;
	}
	@media (min-width: 460px) {
		.stack2 {
			grid-template-columns: 1fr 1fr;
			align-items: start;
			gap: 10px;
		}
	}
	.pcts + .form-msg {
		margin-top: 12px;
	}
	.hint {
		margin-top: 6px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.confirm {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--red);
		border-radius: var(--r);
	}
	.confirm p {
		font-size: var(--fs-sm);
	}
	.sk {
		height: 320px;
		margin-top: 16px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
