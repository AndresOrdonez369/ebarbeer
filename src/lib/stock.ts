// Inventory in the cashier's and the owner's words.
import type { CatalogItem } from './types.js';

export type StockState = 'out' | 'low' | 'ok';

/** null when the item keeps no inventory. */
export function stockState(it: Pick<CatalogItem, 'stock' | 'stockMin'>): StockState | null {
	if (it.stock == null) return null;
	if (it.stock <= 0) return 'out';
	if (it.stock <= (it.stockMin ?? 0)) return 'low';
	return 'ok';
}

export const units = (n: number) => `${n} ${Math.abs(n) === 1 ? 'unidad' : 'unidades'}`;

/** "Quedan 4", "Agotado", or "Faltan 2" when sales went past the count. */
export function stockWords(stock: number): string {
	if (stock < 0) return `Agotado · ${-stock} de más`;
	if (stock === 0) return 'Agotado';
	return `Quedan ${stock}`;
}

/** Items that are out or about to run out, emptiest first. */
export function runningOut(items: CatalogItem[]): CatalogItem[] {
	return items
		.filter((i) => i.active !== false && (stockState(i) === 'low' || stockState(i) === 'out'))
		.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
}
