<script lang="ts">
	import OfflineNote from './OfflineNote.svelte';
	import Plate from './Plate.svelte';
	import { backend, session, signOut } from '../session.svelte.js';
	import { fromIsoDate, shortDate } from '../format.js';

	// offline: false where the screen already says it (the register's "por enviar" notice).
	let { section, offline = true }: { section: string; offline?: boolean } = $props();
	// The shop's business day, not the calendar: at 1 a. m. it is still yesterday's shift.
	let today = $state(shortDate());
	$effect(() => {
		backend
			.businessDate()
			.then((d) => (today = shortDate(fromIsoDate(d))))
			.catch(() => {});
	});
</script>

<header>
	<Plate />
	<div class="who">
		<b>{section} · {session.profile?.displayName}</b>
		<span>{today}{backend.mode === 'demo' ? ' · demostración' : ''}</span>
	</div>
	<button class="out" type="button" onclick={signOut} aria-label="Salir">
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
			<path d="M10 16l-4-4 4-4" />
			<path d="M6 12h10" />
		</svg>
	</button>
</header>
{#if offline}<OfflineNote />{/if}

<style>
	header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px var(--gutter) 10px;
	}
	.who {
		margin-left: auto;
		text-align: right;
		font-size: var(--fs-xs);
		line-height: 1.3;
		color: var(--foam-dim);
		min-width: 0;
	}
	.who b {
		display: block;
		color: var(--foam);
		font-size: var(--fs-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.out {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		margin-right: -8px;
		border: 0;
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		transition:
			color var(--t-fast),
			background-color var(--t-fast);
	}
	.out:hover {
		color: var(--foam);
		background: var(--wood);
	}
	svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
