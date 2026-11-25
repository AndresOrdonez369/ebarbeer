// Visits with photos waiting to reach the server. A visit is written to this phone first
// (IndexedDB: photos are too big for localStorage), then sent; without signal it stays and goes
// out by itself when the network returns. Safe to retry: saveVisit is idempotent on the visit id.
import { backend, session } from './session.svelte.js';
import { AppError, NetworkError, type VisitDraft } from './types.js';

export interface QueuedVisit {
	draft: VisitDraft;
	/** Customer name or number, for the list of pending visits. */
	label: string;
	savedAt: string;
	/** Who saved it: on a shared phone it waits until that person is signed in. */
	staffId?: string;
	status: 'pending' | 'failed';
	error?: string;
}

const DB = 'barbeer-visits';
const STORE = 'visits';

function open(): Promise<IDBDatabase> {
	return new Promise((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'draft.id' });
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await open();
	try {
		return await new Promise<T>((res, rej) => {
			const t = db.transaction(STORE, mode);
			const req = fn(t.objectStore(STORE));
			t.oncomplete = () => res(req.result);
			t.onerror = () => rej(t.error);
			t.onabort = () => rej(t.error);
		});
	} finally {
		db.close();
	}
}

export const visits = $state({ items: [] as QueuedVisit[], sending: false, loaded: false });
/** Whether the signed-in person may send this visit (visits saved before this check have no owner). */
export const isMine = (v: QueuedVisit) => !v.staffId || v.staffId === session.profile?.staffId;
/** Visits being sent right now, so a flush never sends one twice at once. */
const inFlight = new Set<string>();

/** Reads what this phone still has to send. */
export async function loadVisits(): Promise<void> {
	try {
		const all = await tx<QueuedVisit[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedVisit[]>);
		visits.items = all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
	} catch {
		/* storage blocked: nothing waiting */
	}
	visits.loaded = true;
}

async function put(v: QueuedVisit) {
	await tx('readwrite', (s) => s.put($state.snapshot(v) as QueuedVisit));
}

async function drop(id: string) {
	visits.items = visits.items.filter((x) => x.draft.id !== id);
	try {
		await tx('readwrite', (s) => s.delete(id));
	} catch {
		/* already gone */
	}
}

/**
 * Saves a visit: on the phone first, then to the server. Returns the customer id when it went
 * up, null when it waits for the network. Throws AppError when the server refused it (it is then
 * kept as failed, so the photos are not lost).
 */
export async function saveVisit(draft: VisitDraft, label: string): Promise<string | null> {
	const item: QueuedVisit = { draft, label, savedAt: new Date().toISOString(), staffId: session.profile?.staffId, status: 'pending' };
	let stored = true;
	try {
		await put(item);
	} catch {
		stored = false; // no IndexedDB (private mode): try straight away
	}
	visits.items = [item, ...visits.items.filter((x) => x.draft.id !== draft.id)];
	inFlight.add(draft.id);
	try {
		const id = await backend.saveVisit(draft);
		await drop(draft.id);
		return id;
	} catch (e) {
		if (e instanceof NetworkError && stored) return null;
		await fail(draft.id, e instanceof AppError ? e.message : 'No se pudo subir la visita.');
		throw e instanceof AppError ? e : new AppError('No se pudo subir la visita.');
	} finally {
		inFlight.delete(draft.id);
	}
}

async function fail(id: string, error: string) {
	const item = visits.items.find((x) => x.draft.id === id);
	if (!item) return;
	item.status = 'failed';
	item.error = error;
	try {
		await put(item);
	} catch {
		/* kept in memory */
	}
}

/** Sends every waiting visit, oldest first. */
export async function flushVisits(): Promise<void> {
	if (visits.sending) return;
	if (!visits.loaded) await loadVisits();
	if (!visits.items.some((x) => x.status === 'pending' && isMine(x))) return;
	visits.sending = true;
	try {
		for (const item of [...visits.items].reverse()) {
			if (item.status !== 'pending' || !isMine(item) || inFlight.has(item.draft.id)) continue;
			inFlight.add(item.draft.id);
			try {
				await backend.saveVisit(item.draft);
				await drop(item.draft.id);
			} catch (e) {
				if (e instanceof NetworkError) break;
				await fail(item.draft.id, e instanceof AppError ? e.message : 'No se pudo subir la visita.');
			} finally {
				inFlight.delete(item.draft.id);
			}
		}
	} finally {
		visits.sending = false;
	}
}

/** Tries a failed visit again. */
export async function retryVisit(id: string): Promise<void> {
	const item = visits.items.find((x) => x.draft.id === id);
	if (!item) return;
	item.status = 'pending';
	item.error = undefined;
	try {
		await put(item);
	} catch {
		/* kept in memory */
	}
	await flushVisits();
}

/** Throws away a visit that will not go up. */
export const discardVisit = (id: string) => drop(id);
