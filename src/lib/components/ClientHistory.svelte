<!-- A customer's visits, newest first: when, who cut, the note, and the photos. Tapping the
     thumbnails opens the large photos of that visit in place (no modal), side by side. -->
<script lang="ts">
	import { clock, dayLabel, toIsoDate } from '../format.js';
	import { ANGLES, angleLabel } from '../photo.js';
	import type { ClientVisit } from '../types.js';

	let { visits }: { visits: ClientVisit[] } = $props();

	let open = $state<string | null>(null);
	const when = (iso: string) => {
		const d = toIsoDate(new Date(iso));
		return d === toIsoDate(new Date()) ? `Hoy · ${clock(iso)}` : `${dayLabel(d)} · ${clock(iso)}`;
	};
	const sorted = (v: ClientVisit) =>
		[...v.photos].sort((a, b) => ANGLES.findIndex((x) => x.angle === a.angle) - ANGLES.findIndex((x) => x.angle === b.angle));
	const loaded = (e: Event) => (e.currentTarget as HTMLImageElement).classList.add('in');
	// Photos that did not arrive (no signal, an old link): a note instead of an empty box.
	let failed = $state<Record<string, boolean>>({});
</script>

<ol class="visits">
	{#each visits as v (v.id)}
		<li>
			<header>
				<b>{when(v.at)}</b>
				<small>{v.mine ? 'Tú' : (v.barber ?? 'Alguien del local')}</small>
			</header>
			{#if v.note}<p class="note">{v.note}</p>{/if}
			{#if v.photos.length}
				<button
					type="button"
					class="thumbs"
					aria-expanded={open === v.id}
					aria-controls="big-{v.id}"
					onclick={() => (open = open === v.id ? null : v.id)}
				>
					{#each sorted(v) as p (p.angle)}
						<span class="thumb">
							{#if failed[p.thumb]}
								<span class="miss">No cargó</span>
							{:else}
								<img src={p.thumb} alt="" loading="lazy" decoding="async" onload={loaded} onerror={() => (failed[p.thumb] = true)} />
							{/if}
							<small>{angleLabel(p.angle)}</small>
						</span>
					{/each}
					<span class="sr-only">{open === v.id ? 'Cerrar las fotos' : 'Ver las fotos en grande'}</span>
				</button>
				{#if open === v.id}
					<div class="big" id="big-{v.id}" role="region" aria-label="Fotos de la visita" tabindex="-1">
						{#each sorted(v) as p (p.angle)}
							<figure>
								{#if failed[p.full]}
									<span class="miss">No cargó. Revisa la señal y vuelve a abrir el cliente.</span>
								{:else}
									<img src={p.full} alt="{angleLabel(p.angle)} del corte" decoding="async" onload={loaded} onerror={() => (failed[p.full] = true)} />
								{/if}
								<figcaption>{angleLabel(p.angle)}</figcaption>
							</figure>
						{/each}
					</div>
				{/if}
			{:else if v.photosGone}
				<p class="gone">Fotos borradas. Se guardan las de las últimas 3 visitas.</p>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.visits {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	li {
		display: grid;
		gap: 8px;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	header b {
		font-size: var(--fs-sm);
	}
	header small,
	.gone {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.note {
		font-size: var(--fs-sm);
		max-width: 52ch;
	}
	.thumbs {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		text-align: left;
		cursor: zoom-in;
	}
	.thumbs[aria-expanded='true'] {
		cursor: zoom-out;
	}
	.thumb {
		display: grid;
		gap: 4px;
	}
	.thumb img,
	figure img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--wood);
		opacity: 0;
		transition: opacity var(--t-move) var(--ease-out);
	}
	.thumb img:global(.in),
	figure img:global(.in) {
		opacity: 1;
	}
	.miss {
		display: grid;
		place-items: center;
		aspect-ratio: 3 / 4;
		padding: 6px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r);
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		text-align: center;
	}
	.thumb small,
	figcaption {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--foam-dim);
	}
	.thumbs:hover .thumb img,
	.thumbs:focus-visible .thumb img {
		border-color: var(--foam-faint);
	}
	.big {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 82%;
		gap: 8px;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
		scrollbar-color: var(--line-strong) transparent;
		padding-bottom: 6px;
	}
	figure {
		display: grid;
		gap: 4px;
		margin: 0;
		scroll-snap-align: start;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb img,
		figure img {
			transition: none;
		}
	}
</style>
