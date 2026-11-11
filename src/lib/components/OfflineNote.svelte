<script lang="ts">
	import { net } from '../network.svelte.js';
</script>

{#if !net.online}
	<p class="offline" role="status">Sin conexión · lo que ves puede estar atrasado y se pone al día solo</p>
{/if}

<style>
	/* Not settled yet: dashed, like everything waiting on the network. */
	.offline {
		margin: 0 var(--gutter) 8px;
		padding: 8px 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		color: var(--amber);
		font-size: var(--fs-sm);
		font-weight: 700;
	}
</style>
