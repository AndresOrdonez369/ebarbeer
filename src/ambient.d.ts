declare module 'virtual:pwa-register' {
	export function registerSW(options?: {
		immediate?: boolean;
		onOfflineReady?: () => void;
		onNeedRefresh?: () => void;
		onRegisterError?: (error: unknown) => void;
	}): (reloadPage?: boolean) => Promise<void>;
}

// Font packages are CSS-only side-effect imports.
declare module '@fontsource/*';
