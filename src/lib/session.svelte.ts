import { hasStoredSession, isDemo } from './config.js';
import { lazyBackend } from './lazy-backend.js';
import { AppError, type Backend, type Profile, type Role } from './types.js';

export const backend: Backend = lazyBackend(isDemo ? 'demo' : 'live', () =>
	isDemo
		? import('./backend-demo.js').then((m) => m.createDemoBackend())
		: import('./backend-live.js').then((m) => m.createLiveBackend())
);

export const session = $state({
	status: 'loading' as 'loading' | 'out' | 'in',
	profile: null as Profile | null,
	notice: ''
});

let leaving = false;
let watching = false;
// The login can expire or be removed while the app is open. Back to the login screen with a note;
// the bill in progress and anything queued stay on the phone.
function watchAuth() {
	if (watching) return;
	watching = true;
	backend.onAuthLost(() => {
		if (leaving || session.status !== 'in') return;
		session.profile = null;
		session.status = 'out';
		session.notice = 'Tu sesión se cerró. Vuelve a entrar: la cuenta en curso y lo pendiente siguen guardados.';
	});
}

export async function initSession() {
	// Nobody logged in on this phone: show the login now and fetch Supabase in the background.
	if (!isDemo && !hasStoredSession()) {
		session.status = 'out';
		backend.restore().catch(() => {});
		return;
	}
	try {
		const p = await backend.restore();
		session.profile = p;
		session.status = p ? 'in' : 'out';
		if (p) watchAuth();
	} catch (e) {
		session.notice = e instanceof AppError ? e.message : 'No se pudo abrir la sesión.';
		session.profile = null;
		session.status = 'out';
	}
}

export async function signIn(user: string, secret: string) {
	const p = await backend.signIn(user, secret);
	session.notice = '';
	session.profile = p;
	session.status = 'in';
	watchAuth();
}

export async function signOut() {
	leaving = true;
	try {
		await backend.signOut();
	} finally {
		leaving = false;
	}
	session.profile = null;
	session.status = 'out';
}

export const homeFor = (role: Role) => ({ admin: '/admin', cashier: '/caja', barber: '/barbero' })[role];

/** Which sections each role may open. The admin can also work the register. */
export function canEnter(role: Role, path: string): boolean {
	const section = '/' + (path.split('/')[1] ?? '');
	if (role === 'admin') return section === '/admin' || section === '/caja';
	if (role === 'cashier') return section === '/caja';
	return section === '/barbero';
}
