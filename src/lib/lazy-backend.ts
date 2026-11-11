import { NetworkError, type Backend } from './types.js';

/**
 * The backend loads in its own chunk (Supabase alone is ~58 kB gzip), so the first screen paints
 * without waiting for it. Every call waits for the module; subscriptions attach once it arrives.
 */
export function lazyBackend(mode: Backend['mode'], load: () => Promise<Backend>): Backend {
	let ready: Promise<Backend> | null = null;
	// A failed download is forgotten so the next call tries again; it reads as a connection problem.
	const get = () =>
		(ready ??= load().catch(() => {
			ready = null;
			throw new NetworkError('Sin conexión.');
		}));
	return new Proxy({} as Backend, {
		get(_, key: string | symbol) {
			// Not a thenable, not inspectable by symbol: only Backend methods.
			if (typeof key !== 'string' || key === 'then') return undefined;
			const prop = key as keyof Backend;
			if (prop === 'mode') return mode;
			if (prop === 'onSalesChange' || prop === 'onAuthLost')
				return (cb: () => void) => {
					let off: (() => void) | null = null;
					let cancelled = false;
					get()
						.then((b) => {
							if (!cancelled) off = b[prop](cb);
						})
						.catch(() => {});
					return () => {
						cancelled = true;
						off?.();
					};
				};
			if (prop === 'reportError')
				return (message: string, context?: Record<string, unknown>) =>
					void get()
						.then((b) => b.reportError(message, context))
						.catch(() => {});
			return (...args: unknown[]) =>
				get().then((b) => (b[prop] as (...a: unknown[]) => Promise<unknown>).apply(b, args));
		}
	});
}
