<script lang="ts">
	import { backend, session, signIn } from '#lib/session.svelte.js';
	import { AppError } from '#lib/types.js';

	let user = $state('');
	let secret = $state('');
	let busy = $state(false);
	let error = $state(session.notice);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!user.trim() || !secret) {
			error = 'Escribe tu usuario y tu PIN.';
			return;
		}
		await enter(user, secret);
	}

	async function enter(u: string, s: string) {
		busy = true;
		error = '';
		try {
			await signIn(u, s);
		} catch (err) {
			error = err instanceof AppError ? err.message : 'No se pudo entrar. Intenta de nuevo.';
			busy = false;
		}
	}
</script>

<svelte:head><title>Ingresar · Bar Beer</title></svelte:head>

<main>
	<div class="art">
		<img src="/brand/logo.webp" alt="Bar Beer" width="720" height="524" fetchpriority="high" />
	</div>

	<div class="panel">
		<h1 class="fig">Ingresa</h1>

		{#if backend.mode === 'live'}
			<form onsubmit={submit} novalidate>
				<label>
					<span class="label">Usuario o correo</span>
					<input
						bind:value={user}
						name="username"
						autocomplete="username"
						autocapitalize="none"
						spellcheck="false"
						enterkeyhint="next"
						placeholder="kike"
						required
					/>
				</label>
				<label>
					<span class="label">PIN o contraseña</span>
					<input
						bind:value={secret}
						name="password"
						type="password"
						autocomplete="current-password"
						enterkeyhint="go"
						required
					/>
				</label>
				<p class="error" role="alert">{error}</p>
				<button class="go fig" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
			</form>
			<p class="help">¿Olvidaste tu PIN? El administrador lo cambia desde Equipo.</p>
		{:else}
			<p class="demo">
				Modo demostración. Todo lo que ves son datos de ejemplo; nada se guarda. Elige cómo entrar:
			</p>
			<div class="roles">
				<button type="button" disabled={busy} onclick={() => enter('demo:cashier', '')}>
					<b class="fig">Caja</b><span>Luisa cobra y asigna cortes</span>
				</button>
				<button type="button" disabled={busy} onclick={() => enter('demo:barber', '')}>
					<b class="fig">Barbero</b><span>Kike mira su jarra del día</span>
				</button>
				<button type="button" disabled={busy} onclick={() => enter('demo:admin', '')}>
					<b class="fig">Administración</b><span>El negocio en vivo</span>
				</button>
			</div>
			<p class="error" role="alert">{error}</p>
		{/if}
	</div>
</main>

<style>
	main {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.art {
		position: relative;
	}
	.art img {
		width: 100%;
		height: auto;
		aspect-ratio: 720 / 524;
		object-fit: cover;
	}
	/* Wood bleeds into the bar counter below. */
	.art::after {
		content: '';
		position: absolute;
		inset: auto 0 0;
		height: 14%;
		background: linear-gradient(transparent, var(--bg));
	}
	.panel {
		position: relative;
		margin-top: 4px;
		padding: 0 var(--gutter) calc(32px + var(--safe-bottom));
	}
	h1 {
		font-size: var(--fs-fig-lg);
		margin-bottom: 16px;
	}
	form {
		display: grid;
		gap: 14px;
	}
	label {
		display: grid;
		gap: 6px;
	}
	input {
		height: 52px;
		padding: 0 14px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		font-size: 1.125rem;
		transition: border-color var(--t-fast);
	}
	input::placeholder {
		color: var(--foam-faint);
	}
	input:hover {
		border-color: var(--foam-faint);
	}
	input:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}
	.error {
		min-height: 1.4em;
		color: var(--danger-text);
		font-size: var(--fs-sm);
	}
	.go {
		height: 60px;
		border: 0;
		border-radius: var(--r);
		background: var(--red);
		color: #fff;
		font-size: var(--fs-fig-md);
		box-shadow: 0 3px 0 var(--red-lip);
		transition:
			background-color var(--t-fast),
			transform var(--t-fast),
			box-shadow var(--t-fast);
	}
	.go:hover:not(:disabled) {
		background: var(--red-hover);
	}
	.go:active:not(:disabled) {
		transform: translateY(3px);
		box-shadow: 0 0 0 var(--red-lip);
	}
	.go:disabled {
		opacity: 0.7;
	}
	.help {
		margin-top: 18px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.demo {
		color: var(--foam-dim);
		font-size: var(--fs-sm);
		margin-bottom: 14px;
		max-width: 44ch;
	}
	.roles {
		display: grid;
		gap: 8px;
	}
	.roles button {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		min-height: 64px;
		padding: 12px 16px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--wood);
		text-align: left;
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast);
	}
	.roles button:hover:not(:disabled) {
		background: var(--wood-raised);
		border-color: var(--foam-faint);
	}
	.roles b {
		font-size: var(--fs-fig-md);
	}
	.roles span {
		color: var(--foam-dim);
		font-size: var(--fs-sm);
		text-align: right;
	}
</style>
