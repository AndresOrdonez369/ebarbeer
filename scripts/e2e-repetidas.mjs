// End-to-end check of bills charged twice by mistake, in demo mode, at phone size, with headless Edge:
// the register asks before charging a bill identical to one charged minutes ago (online and offline),
// "Hoy" marks a likely repeat and voids it in two taps, and the owner voids bills from "Cuentas".
//   node scripts/e2e-repetidas.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p9-*.png.
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5175';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e9-')),
	args: ['--no-first-run', '--no-default-browser-check']
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let failures = 0;
const check = (cond, label) => {
	console.log(`${cond ? '  ok  ' : '  FAIL'} ${label}`);
	if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
const tap = (label, scope = 'button, a, [role="tab"]') =>
	page.evaluate(
		(t, s) => {
			const b = [...document.querySelectorAll(s)].find((x) =>
				x.textContent.replace(/\s+/g, ' ').replace(/^\s*META\s*/, '').trim().startsWith(t)
			);
			if (!b) throw new Error('no button ' + t);
			b.click();
		},
		label,
		scope
	);
const shot = async (name, selector = null) => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate((sel) => {
		if (!sel) return;
		document.querySelector(sel)?.scrollIntoView({ block: 'start' });
		scrollBy(0, -12);
	}, selector);
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p9-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};
const cut = async (barber) => {
	await tap(barber);
	await tap('Corte 20', 'button.item');
	await sleep(100);
	await tap('Cobrar $ 20.000');
	await sleep(250);
	await tap('Exacto');
	await sleep(80);
	await tap('Cobrar $ 20.000');
	await sleep(1000);
};
const saleCount = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('barbeer-demo-state') ?? '{}').sales?.length ?? null);

await page.goto(BASE + '/ingreso');
await page.evaluate(() => localStorage.clear());

console.log('Register: the same cut twice');
await as('cashier', '/caja');
await tap('Igual que la última vez').catch(() => {});
await sleep(100);
await tap('Abrir caja con').catch(() => {});
await sleep(500);
await cut('Dago');
check((await text()).includes('N.º 0024'), 'first cut charged as 0024');
await tap('Nueva cuenta');
await sleep(400);
const before = await saleCount();
await cut('Dago');
let t = await text();
check(t.includes('¿Cobrar otra vez?') && t.includes('N.º 0024') && t.includes('Efectivo'), 'the same cut again asks first, naming 0024');
check(await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('No cobrar')), 'focus lands on "No cobrar"');
await shot('1-otra-vez');
await tap('No cobrar, ya estaba cobrada');
await sleep(300);
t = await text();
check(t.includes('No se cobró otra vez') && t.includes('Cuenta vacía'), '"No cobrar" empties the bill');
check((await saleCount()) === before, 'nothing was charged');

console.log('Register: another customer after all');
await cut('Dago');
await tap('Sí, es otro cliente');
await sleep(1000);
check((await text()).includes('N.º 0025'), '"es otro cliente" charges it as 0025');
await tap('Nueva cuenta');
await sleep(400);
await cut('Kike');
check((await text()).includes('N.º 0026') && !(await text()).includes('¿Cobrar otra vez?'), 'another barber is charged straight away');
await tap('Nueva cuenta');
await sleep(400);

console.log('Register: offline, against the queue');
await page.setOfflineMode(true);
await cut('Jota');
check((await text()).includes('Por enviar'), 'offline cut queued');
await tap('Nueva cuenta');
await sleep(300);
await cut('Jota');
t = await text();
check(t.includes('¿Cobrar otra vez?') && t.includes('todavía por enviar'), 'offline, a repeat of the queued bill asks too');
await tap('No cobrar, ya estaba cobrada');
await sleep(200);
await page.setOfflineMode(false);
await page.evaluate(() => dispatchEvent(new Event('online')));
await sleep(1500);

console.log('Hoy: spot the repeat and void it');
await as('cashier', '/caja/hoy');
t = await text();
check(t.includes('¿Repetida? Igual a la N.º 0024'), '0025 is marked as a likely repeat of 0024');
await shot('2-hoy-repetida', '.twin');
await page.evaluate(() => {
	const row = [...document.querySelectorAll('.sales > li .row')].find((r) => r.textContent.includes('N.º 0025'));
	row.click();
});
await sleep(200);
await tap('Se cobró dos veces');
await sleep(80);
check(await page.evaluate(() => document.querySelector('.sales .reason input').value === 'Se cobró dos veces'), 'a reason chip fills the reason');
await shot('3-anular', '.sales .voidnote');
await tap('Anular cuenta');
await sleep(800);
t = await text();
check(!t.includes('¿Repetida? Igual a la N.º 0024'), 'once voided it is no longer marked');
check(await page.evaluate(() => [...document.querySelectorAll('.sales > li.void')].some((li) => li.textContent.includes('N.º 0025'))), '0025 shows as voided');

console.log('Owner: Cuentas');
await as('admin', '/admin/mas');
check((await text()).includes('Cuentas cobradas'), 'Más links to Cuentas');
await as('admin', '/admin/cuentas');
t = await text();
check(t.includes('Cuentas') && t.includes('N.º 0026') && /anuladas?/.test(t), "today's bills are listed with the voided count");
await page.evaluate(() => {
	const row = [...document.querySelectorAll('.sales > li .row')].find((r) => r.textContent.includes('N.º 0026'));
	row.click();
});
await sleep(200);
await tap('Error al cobrar');
await tap('Anular cuenta');
await sleep(800);
check(await page.evaluate(() => [...document.querySelectorAll('.sales > li.void')].some((li) => li.textContent.includes('N.º 0026'))), 'the owner voids 0026');
await shot('4-cuentas', '.sum');
await page.click('button[aria-label="Periodo anterior"]');
await sleep(600);
check((await text()).includes('Sin cuentas') || (await text()).includes('N.º'), 'the day stepper goes to yesterday');
await as('admin', '/admin/anulaciones');
check((await text()).includes('Error al cobrar') && (await text()).includes('Se cobró dos veces'), 'both voids are in Anulaciones with their reasons');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
