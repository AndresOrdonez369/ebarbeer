// JavaScript a phone downloads to show a screen (gzip, as Cloudflare serves it), against `npm run preview`.
//   node scripts/measure.mjs [baseUrl]
// For each screen: JS that arrived before its title showed, total JS, and time to title on emulated 4G.
import puppeteer, { PredefinedNetworkConditions } from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const kb = (n) => (n / 1024).toFixed(1) + ' kB';

const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-measure-')),
	args: ['--no-first-run']
});

async function measure(label, path, role) {
	const page = await browser.newPage();
	await page.setCacheEnabled(false);
	if (role) {
		await page.goto(BASE + '/ingreso', { waitUntil: 'networkidle0' });
		await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	}
	// A phone on a slow mobile connection, so chunks that load in parallel show as not blocking.
	await page.emulateNetworkConditions(PredefinedNetworkConditions['Fast 4G']);
	const files = new Set();
	page.on('response', (r) => {
		const u = new URL(r.url());
		if (u.pathname.endsWith('.js')) files.add(u.pathname);
	});
	const t0 = Date.now();
	await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
	// What had to arrive before the screen showed its title (the splash has none).
	await page.waitForSelector('h1', { timeout: 15000 });
	const first = [...files];
	const ms = Date.now() - t0;
	await page.waitForNetworkIdle();
	const size = (list) => list.reduce((s, f) => s + gzipSync(readFileSync(join('build', f))).length, 0);
	const total = size([...files]);
	console.log(`${label.padEnd(18)} pantalla ${kb(size(first)).padStart(8)} · total ${kb(total).padStart(8)} · ${String(ms).padStart(5)} ms en 4G`);
	await page.close();
	return total;
}

await measure('Ingreso', '/ingreso');
await measure('Caja', '/caja', 'cashier');
await measure('Barbero', '/barbero', 'barber');
await measure('Admin · En vivo', '/admin', 'admin');
await browser.close();
