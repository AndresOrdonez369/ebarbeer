// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {}
}

interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
	readonly VITE_SHOP_SLUG?: string;
	readonly VITE_STAFF_EMAIL_DOMAIN?: string;
}

export {};
