const env = import.meta.env;

export const config = {
	supabaseUrl: env.VITE_SUPABASE_URL ?? '',
	supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
	shopSlug: env.VITE_SHOP_SLUG ?? 'bar-beer',
	staffEmailDomain: env.VITE_STAFF_EMAIL_DOMAIN ?? 'staff.barbeer.app'
};

/** Without Supabase keys the app runs on in-memory example data so it can be shown and designed. */
export const isDemo = env.VITE_DEMO === '1' || !config.supabaseUrl || !config.supabaseAnonKey;

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
