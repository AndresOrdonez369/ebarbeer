// Review screenshots of the demo app with headless Edge.
//   node scripts/capture.mjs [baseUrl]
// Motion is settled before each capture so a pour or slam never reads as a missing element.
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5174';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });

const shots = [
	{ file: 'mobile-ingreso.png', role: null, path: '/ingreso', w: 375, h: 812 },
	{ file: 'mobile-caja.png', role: 'cashier', path: '/caja', w: 375, h: 812, full: true },
	{ file: 'mobile-caja-cuenta.png', role: 'cashier', path: '/caja', w: 375, h: 812, fill: true },
	{ file: 'mobile-barbero.png', role: 'barber', path: '/barbero', w: 375, h: 812 },
	{ file: 'mobile-admin.png', role: 'admin', path: '/admin', w: 375, h: 812, full: true },
	{ file: 'mobile-equipo.png', role: 'admin', path: '/admin/equipo', w: 375, h: 812 },
	{ file: 'desktop-caja.png', role: 'cashier', path: '/caja', w: 1280, h: 800 }
];

// A throwaway profile, so a running Edge window never swallows the launch.
const profile = mkdtempSync(join(tmpdir(), 'barbeer-capture-'));
const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: profile,
	args: ['--no-first-run', '--no-default-browser-check']
});
for (const s of shots) {
	const page = await browser.newPage();
	await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 2, isMobile: s.w < 768, hasTouch: s.w < 768 });
	await page.goto(BASE + '/ingreso');
	await page.evaluate((role) => {
		if (role) sessionStorage.setItem('barbeer-demo-role', role);
		else sessionStorage.removeItem('barbeer-demo-role');
	}, s.role);
	await page.goto(BASE + s.path, { waitUntil: 'networkidle0' });
	await page.evaluate(() => document.fonts.ready);
	await new Promise((r) => setTimeout(r, 1200));
	if (s.fill) {
		await page.evaluate(async () => {
			const norm = (b) => b.textContent.replace(/\s+/g, ' ').trim();
			const q = (t) => [...document.querySelectorAll('button')].find((b) => norm(b).startsWith(t));
			const tick = () => new Promise((r) => setTimeout(r, 60));
			q('Kike').click();
			q('Corte + barba').click();
			q('Productos').click();
			await tick();
			q('Cera mate').click();
			q('Bebidas').click();
			await tick();
			q('Cerveza 6').click();
			q('Cerveza 6').click();
			await tick();
		});
	}
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await new Promise((r) => setTimeout(r, 200));
	await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: !!s.full });
	console.log('captured', s.file);
	await page.close();
}
await browser.close();
