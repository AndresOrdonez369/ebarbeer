<!-- The BAR BEER blade from the logo: black, red with the mug, blue, chrome edge. -->
<script lang="ts">
	let { size = 'md' }: { size?: 'md' | 'lg' } = $props();
</script>

<span class="plate {size}" role="img" aria-label="Bar Beer">
	<span class="k"><i>BAR</i></span>
	<span class="r">
		<svg viewBox="0 0 14 16" aria-hidden="true">
			<path
				d="M1 3a2 2 0 0 1 3-1.6A2.4 2.4 0 0 1 8 1.2 2 2 0 0 1 11 3v1h1.2A1.8 1.8 0 0 1 14 5.8v4.4a1.8 1.8 0 0 1-1.8 1.8H11v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm10 3v4h1V6z"
			/>
		</svg>
	</span>
	<span class="b"><i>BEER</i></span>
</span>

<style>
	.plate {
		display: inline-flex;
		transform: skewX(-14deg);
		border: 2px solid var(--chrome);
		box-shadow:
			0 2px 0 #000,
			0 6px 14px rgb(0 0 0 / 0.6);
		flex: none;
	}
	.plate > span {
		display: flex;
		align-items: center;
		height: 26px;
		padding: 0 9px;
		font: 700 15px/1 var(--font-ui);
		letter-spacing: 0.16em;
		color: #fff;
	}
	.plate i {
		font-style: normal;
		transform: skewX(14deg);
	}
	.k {
		background: #000;
	}
	.r {
		background: var(--red);
		padding: 0 7px !important;
	}
	.b {
		background: var(--blue);
	}
	svg {
		width: 14px;
		height: 16px;
		fill: #fff;
		transform: skewX(14deg);
	}
	.lg > span {
		height: 40px;
		padding: 0 14px;
		font-size: 22px;
	}
	.lg svg {
		width: 20px;
		height: 23px;
	}
</style>
