<script lang="ts">
	import type { Snippet } from 'svelte';

	// flush: inside a container that already has the page gutter.
	let { title, flush = false, children }: { title: string; flush?: boolean; children?: Snippet } = $props();
</script>

<section class="empty" class:flush>
	<h2 class="fig">{title}</h2>
	{#if children}<div class="body">{@render children()}</div>{/if}
</section>

<style>
	.empty {
		margin: 24px var(--gutter);
		padding: 20px 16px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r);
	}
	.flush {
		margin-inline: 0;
	}
	h2 {
		font-size: var(--fs-fig-md);
		color: var(--foam);
	}
	.body {
		margin-top: 8px;
		color: var(--foam-dim);
		font-size: var(--fs-sm);
		max-width: 46ch;
	}
	.body :global(p + p) {
		margin-top: 6px;
	}
</style>
