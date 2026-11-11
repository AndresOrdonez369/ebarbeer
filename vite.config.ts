import adapter from '@sveltejs/adapter-static';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		withPwa(
			{
				compilerOptions: {
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				// SPA: every route falls back to index.html; Cloudflare Pages serves it.
				adapter: adapter({ fallback: 'index.html' })
			},
			{
				strategies: 'generateSW',
				registerType: 'autoUpdate',
				// Registered from +layout.svelte: the SPA fallback page is written after this plugin runs.
				injectRegister: false,
				kit: { spa: true, adapterFallback: 'index.html' },
				manifest: {
					name: 'Bar Beer',
					short_name: 'Bar Beer',
					description: 'Caja, barberos y negocio de Bar Beer.',
					lang: 'es-CO',
					start_url: '/',
					scope: '/',
					display: 'standalone',
					orientation: 'portrait',
					background_color: '#0C0906',
					theme_color: '#0C0906',
					icons: [
						{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
						{
							src: '/icons/icon-maskable-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				generateSW: {
					globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg}'],
					// SPA build has no prerendered pages; the plugin's own pattern for them may match nothing.
					globStrict: false,
					// Never cache Supabase traffic: money data must be live.
					navigateFallbackDenylist: [/^\/b\//]
				}
			}
		)
	]
});
