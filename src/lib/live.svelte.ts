import { backend } from './session.svelte.js';
import { AppError } from './types.js';

/**
 * Loads data and reloads it whenever a sale is charged or voided in the shop.
 * Call during component setup.
 */
export function live<T>(load: () => Promise<T>) {
	const state = $state({ data: null as T | null, error: '', loading: true });

	async function refresh() {
		try {
			state.data = await load();
			state.error = '';
		} catch (e) {
			state.error = e instanceof AppError ? e.message : 'Algo falló al cargar. Intenta de nuevo.';
			backend.reportError(String(e));
		} finally {
			state.loading = false;
		}
	}

	$effect(() => {
		refresh();
		// Back online: catch up at once instead of waiting for the next sale.
		addEventListener('online', refresh);
		const off = backend.onSalesChange(refresh);
		return () => {
			removeEventListener('online', refresh);
			off();
		};
	});

	return Object.assign(state, { refresh });
}

/** Loads once. */
export function once<T>(load: () => Promise<T>) {
	const state = $state({ data: null as T | null, error: '', loading: true });
	const run = () =>
		load()
			.then((d) => {
				state.data = d;
				state.error = '';
			})
			.catch((e) => (state.error = e instanceof AppError ? e.message : 'Algo falló al cargar.'))
			.finally(() => (state.loading = false));
	$effect(() => {
		run();
		// Failed while offline: try again when the connection returns.
		const retry = () => {
			if (state.error) run();
		};
		addEventListener('online', retry);
		return () => removeEventListener('online', retry);
	});
	return state;
}
