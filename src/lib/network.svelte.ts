// Whether this phone has a connection, as the browser sees it. Shared by every screen.
export const net = $state({ online: typeof navigator === 'undefined' ? true : navigator.onLine });

if (typeof window !== 'undefined') {
	addEventListener('online', () => (net.online = true));
	addEventListener('offline', () => (net.online = false));
}
