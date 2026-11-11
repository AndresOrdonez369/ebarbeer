<!-- Admin edits the WhatsApp receipt text, with a live preview on a sample bill. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { buildReceiptMessage, DEFAULT_TEMPLATE, PLACEHOLDERS } from '#lib/receipt.js';
	import { receiptSettings } from '#lib/receipt-settings.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError } from '#lib/types.js';

	let text = $state('');
	let shop = $state('Bar Beer');
	let loaded = $state(false);
	let saving = $state(false);
	let note = $state('');
	let error = $state('');
	let area = $state<HTMLTextAreaElement>();

	onMount(async () => {
		try {
			const s = await backend.receiptSettings();
			shop = s.shopName;
			text = s.template ?? DEFAULT_TEMPLATE;
		} catch (e) {
			error = e instanceof AppError ? e.message : 'No se pudo cargar la plantilla.';
			text = DEFAULT_TEMPLATE;
		}
		loaded = true;
	});

	// Example bill for the preview (synthetic).
	const preview = $derived(
		buildReceiptMessage(text, {
			shop,
			receiptNo: 147,
			createdAt: new Date().toISOString(),
			lines: [
				{ name: 'Corte + barba', qty: 1, total: 30000, barber: 'Esteban' },
				{ name: 'Cerveza', qty: 2, total: 12000, barber: null }
			],
			total: 42000,
			payments: [{ method: 'cash', amount: 42000 }],
			customerName: 'Andrés Pérez',
			link: `${location.origin}/b/ejemplo`
		})
	);

	// The textarea grows with its text so the preview stays right below it while typing on a phone.
	function grow() {
		if (!area) return;
		area.style.height = 'auto';
		area.style.height = `${area.scrollHeight + 2}px`;
	}
	$effect(() => {
		void text;
		requestAnimationFrame(grow);
	});

	function insert(key: string) {
		const el = area;
		const token = `{${key}}`;
		if (!el) {
			text += token;
			return;
		}
		const start = el.selectionStart ?? text.length;
		const end = el.selectionEnd ?? text.length;
		text = text.slice(0, start) + token + text.slice(end);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + token.length, start + token.length);
		});
	}

	async function save() {
		saving = true;
		note = '';
		error = '';
		try {
			const value = text.trim() === DEFAULT_TEMPLATE.trim() ? null : text;
			await backend.saveReceiptTemplate(value);
			receiptSettings.value = { shopName: shop, template: value };
			note = 'Guardada. Las próximas boletas usan este texto.';
		} catch (e) {
			error = e instanceof AppError ? e.message : 'No se pudo guardar.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Plantilla de la boleta · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Boleta por WhatsApp</h1>
	<p class="note">El mensaje que recibe el cliente. Debajo del texto ves cómo le llega, con una cuenta inventada.</p>

	<div class="fieldhead">
		<label class="label" for="tpl">Texto</label>
		<button type="button" class="link" onclick={() => (text = DEFAULT_TEMPLATE)} disabled={!loaded || saving}>
			Volver al original
		</button>
	</div>
	<textarea id="tpl" bind:this={area} bind:value={text} rows="4" spellcheck="true" disabled={!loaded || saving}
	></textarea>
	<!-- The preview sits right under the field so it stays in sight while typing. -->
	<pre class="bubble" aria-label="Así le llega al cliente">{preview}</pre>

	<h2 class="fig heading">Insertar un dato</h2>
	<p class="note">Toca uno para ponerlo donde está el cursor.</p>
	<div class="chips" aria-label="Datos de la cuenta">
		{#each PLACEHOLDERS as p (p.key)}
			<button type="button" onclick={() => insert(p.key)} disabled={!loaded}>
				<b>{`{${p.key}}`}</b><span>{p.hint}</span>
			</button>
		{/each}
	</div>

	<p class="ok" role="status">{note}</p>
	<p class="err" role="alert">{error}</p>
	<button type="button" class="save fig" onclick={save} disabled={!loaded || saving}>
		{saving ? 'Guardando…' : 'Guardar plantilla'}
	</button>
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 0;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 40px;
		margin-left: -6px;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		text-decoration: none;
	}
	.back:hover {
		color: var(--foam);
	}
	.back svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.heading {
		margin-top: 24px;
		font-size: 1.25rem;
	}
	.note {
		margin: 6px 0 12px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.chips {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: stretch;
		gap: 6px;
	}
	.chips button {
		display: grid;
		align-content: start;
		gap: 2px;
		min-height: var(--tap);
		padding: 6px 10px;
		text-align: left;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font-size: var(--fs-sm);
		font-weight: 700;
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast);
	}
	.chips b {
		font-weight: 700;
	}
	.chips span {
		font-size: var(--fs-xs);
		font-weight: 500;
		color: var(--foam-dim);
		line-height: 1.25;
	}
	.chips button:hover:not(:disabled) {
		background: var(--wood);
		border-color: var(--foam-faint);
	}
	.fieldhead {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2px;
	}
	textarea {
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		color: var(--foam);
		font: 500 var(--fs-md) / 1.5 var(--font-ui);
		resize: none;
		overflow: hidden;
		min-height: 120px;
		transition: border-color var(--t-fast);
	}
	textarea:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}

	.link {
		height: 40px;
		border: 0;
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.link:hover:not(:disabled) {
		color: var(--foam);
	}
	/* A chat bubble, drawn in the world's own materials. */
	.bubble {
		margin: 8px 0 0;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: var(--r) var(--r) var(--r) 0;
		background: var(--wood-raised);
		color: var(--foam);
		font: 500 var(--fs-sm) / 1.5 var(--font-ui);
		white-space: pre-wrap;
		word-break: break-word;
	}
	.ok {
		min-height: 1.2em;
		margin-top: 14px;
		font-size: var(--fs-sm);
		color: var(--foam);
	}
	.err {
		min-height: 1.2em;
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	.save {
		width: 100%;
		min-height: 56px;
		margin-top: 6px;
		border: 0;
		border-radius: var(--r);
		background: var(--foam);
		color: var(--bg);
		font-size: var(--fs-fig-sm);
		transition: background-color var(--t-fast);
	}
	.save:hover:not(:disabled) {
		background: #fff;
	}
</style>
