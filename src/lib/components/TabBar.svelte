<script lang="ts">
	import { page } from '$app/state';

	let { items }: { items: { href: string; label: string; also?: string[] }[] } = $props();

	// Exact match for a section's home, prefix match for the others (plus any sub-pages they own).
	const isOn = (item: { href: string; also?: string[] }, i: number) => {
		const p = page.url.pathname;
		if (item.also?.some((a) => p.startsWith(a))) return true;
		return i === 0 ? p === item.href : p.startsWith(item.href);
	};
</script>

<nav aria-label="Secciones" style:--n={items.length} class:dense={items.length > 4}>
	{#each items as item, i (item.href)}
		<a href={item.href} aria-current={isOn(item, i) ? 'page' : undefined}>{item.label}</a>
	{/each}
</nav>

<style>
	nav {
		position: fixed;
		z-index: 10;
		left: 0;
		right: 0;
		bottom: 0;
		max-width: var(--app-max, 520px);
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		padding-bottom: var(--safe-bottom);
		background: var(--bg);
		border-top: 1px solid var(--line);
	}
	a {
		display: grid;
		place-items: center;
		height: 56px;
		font-weight: 700;
		font-size: var(--fs-xs);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--foam-dim);
		transition: color var(--t-fast);
	}
	.dense a {
		letter-spacing: 0.02em;
		font-size: 0.6875rem;
	}
	a:hover {
		color: var(--foam);
	}
	a[aria-current='page'] {
		color: var(--foam);
		box-shadow: inset 0 3px 0 var(--amber);
	}
</style>
