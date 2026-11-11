// Accessibility sweep with axe-core over every screen of the three roles, in demo mode, at phone size.
//   node scripts/a11y.mjs [baseUrl]
// Fails on any violation of WCAG 2.1 A/AA rules.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const screens = [
	[null, '/ingreso'],
	['cashier', '/caja'],
	['cashier', '/caja/hoy'],
	['cashier', '/caja/cierre'],
	['cashier', '/caja/barberos'],
	['cashier', '/caja/barberos/d-kike'],
	['barber', '/barbero'],
	['barber', '/barbero/historial'],
	['barber', '/barbero/metas'],
	['admin', '/admin'],
	['admin', '/admin/equipo'],
	['admin', '/admin/equipo/d-dago'],
	['admin', '/admin/catalogo'],
	['admin', '/admin/catalogo/d-item-0'],
	['admin', '/admin/mas'],
	['admin', '/admin/clientes'],
	['admin', '/admin/local'],
	['admin', '/admin/boleta'],
	['admin', '/admin/reportes'],
	['admin', '/admin/bonos'],
	['admin', '/admin/bonos/d-r1'],
	['admin', '/admin/pagos'],
	['admin', '/admin/pagos/d-dago?k=week&o=0'],
	['admin', '/admin/cierres'],
	['admin', '/admin/anulaciones'],
	[null, '/b/demo0000000000000000000000000023'],
	// The payment step: pick a barber, add a cut, open Cobrar.
	['cashier', '/caja', async () => {
		await page.evaluate(() => {
			document.querySelector('.lineup button, [aria-pressed]')?.click();
			const corte = [...document.querySelectorAll('button.item')].find((b) => b.textContent.includes('Corte'));
			corte?.click();
		});
		await new Promise((r) => setTimeout(r, 200));
		await page.evaluate(() => document.querySelector('.charge .go')?.click());
		await new Promise((r) => setTimeout(r, 400));
		return 'pago';
	}]
];

const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-a11y-')),
	args: ['--no-first-run']
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(BASE + '/ingreso', { waitUntil: 'networkidle0' });

let total = 0;
for (const [role, path, act] of screens) {
	await page.evaluate((r) => (r ? sessionStorage.setItem('barbeer-demo-role', r) : sessionStorage.removeItem('barbeer-demo-role')), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await new Promise((r) => setTimeout(r, 1200));
	const step = act ? await act() : '';
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate(axeSource);
	const res = await page.evaluate(() =>
		// @ts-expect-error injected
		axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
	);
	const v = res.violations;
	total += v.length;
	console.log(`${v.length ? '  FAIL' : '  ok  '} ${path}${step ? ' · ' + step : ''}${role ? ` (${role})` : ''}  ${res.passes.length} reglas aprobadas`);
	for (const x of v)
		console.log(`         ${x.id} [${x.impact}] ${x.help}\n           ${x.nodes.slice(0, 3).map((n) => n.target.join(' ') + (n.failureSummary ? ' — ' + n.failureSummary.split('\n').slice(1, 2).join('') : '')).join('\n           ')}`);
}
await browser.close();
console.log(total ? `${total} violations` : 'all passed');
process.exit(total ? 1 : 0);
