import { backend } from './session.svelte.js';
import type { ReceiptSettings } from './types.js';

/** Shop name and receipt template, loaded once per session and refreshed after the admin edits it. */
export const receiptSettings = $state<{ value: ReceiptSettings | null }>({ value: null });

let loading: Promise<void> | null = null;
export function ensureReceiptSettings() {
	if (receiptSettings.value || loading) return loading;
	loading = backend
		.receiptSettings()
		.then((v) => {
			receiptSettings.value = v;
		})
		.catch(() => {
			receiptSettings.value = { shopName: 'Bar Beer', template: null };
		})
		.finally(() => {
			loading = null;
		});
	return loading;
}
