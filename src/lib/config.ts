const env = import.meta.env;

export const config = {
	supabaseUrl: env.VITE_SUPABASE_URL ?? '',
	supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
	shopSlug: env.VITE_SHOP_SLUG ?? 'bar-beer',
	staffEmailDomain: env.VITE_STAFF_EMAIL_DOMAIN ?? 'staff.barbeer.app'
};

/** Example data only when asked for explicitly (`npm run dev:demo`, the automated tests). */
export const isDemo = env.VITE_DEMO === '1';

/** The published app must point at Supabase; without it, it says so instead of inventing data. */
export const needsSetup = !isDemo && (!config.supabaseUrl || !config.supabaseAnonKey);

/**
 * Staff log in with a short username; Supabase needs an email. Must match the address the
 * create-staff Edge Function builds: <username>.<shop-slug>@<domain>. Admins type their email.
 */
export function loginEmail(input: string): string {
	const v = input.trim().toLowerCase();
	return v.includes('@') ? v : `${v}.${config.shopSlug}@${config.staffEmailDomain}`;
}

/** Whether Supabase left a saved login in this browser (its key is sb-<project>-auth-token). */
export function hasStoredSession(): boolean {
	try {
		return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
	} catch {
		return true; // cannot tell: ask Supabase
	}
}
