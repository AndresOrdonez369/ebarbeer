// End-to-end check of cash taken out of the drawer ("sacar efectivo"), in demo mode, at phone size,
// with headless Edge: the register takes cash with a reason, the expected cash drops, mistakes are
// voided, the closing records it, a closed day cannot change, and the owner sees it in Cierres.
//   node scripts/e2e-salidas.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p10-*.png.
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
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e10-')),
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
const tap = (label, scope = 'button, a') =>
	page.evaluate(
		(t, s) => {
			const b = [...document.querySelectorAll(s)].find((x) => x.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
			if (!b) throw new Error('no button ' + t);
			b.click();
		},
		label,
		scope
	);
const fill = (label, value, scope = 'body') =>
	page.evaluate(
		(l, v, s) => {
			const lab = [...document.querySelector(s).querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(l));
			const el = lab?.querySelector('input, textarea');
			if (!el) throw new Error('no field labelled ' + l);
			el.value = v;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		},
		label,
		value,
		scope
	);
const expected = () => page.evaluate(() => Number(document.querySelector('.expected .big')?.textContent.replace(/[^0-9]/g, '') ?? NaN));
const shot = async (name, selector = null) => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate((sel) => {
		if (!sel) return scrollTo(0, 0);
		document.querySelector(sel)?.scrollIntoView({ block: 'start' });
		scrollBy(0, -12);
	}, selector);
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p10-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};

await page.goto(BASE + '/ingreso');
await page.evaluate(() => localStorage.clear());

console.log('Register: open the day, then take cash out');
await as('cashier', '/caja');
await tap('Igual que la última vez').catch(() => {});
await sleep(100);
await tap('Abrir caja con').catch(() => {});
await sleep(500);
await as('cashier', '/caja/cierre');
let t = await text();
check(t.includes('Salidas de efectivo') && t.includes('Nada ha salido del cajón hoy'), 'the closing screen has a salidas block, empty');
const before = await expected();
check(before > 20000, `the drawer should hold ${before}`);
await tap('Sacar efectivo');
await sleep(150);
await fill('Cuánto sacas', '20000', '.outs');
await tap('Cigarrillos', '.outs .chip');
await sleep(100);
check((await text()).includes(`Quedarán en el cajón $ ${(before - 20000).toLocaleString('es-CO')}`), 'it says what will stay in the drawer');
await shot('1-sacar', '.outs');
await tap('Sacar $ 20.000', '.outs button');
await sleep(700);
t = await text();
check(t.includes('Salida registrada: $ 20.000 · Cigarrillos.'), 'the salida is confirmed');
check(await page.evaluate(() => [...document.querySelectorAll('.outs .list li')].some((li) => li.textContent.includes('Cigarrillos') && li.textContent.includes('Luisa') && li.textContent.includes('20.000'))), 'listed with reason, who and amount');
check((await expected()) === before - 20000, 'the expected cash drops by 20.000');
check(t.includes('− salidas $ 20.000'), 'the calculation shows the salidas');
await shot('2-registrada', '.expected');

console.log('Register: what it refuses');
await tap('Sacar efectivo');
await sleep(150);
await fill('Cuánto sacas', String(before), '.outs');
await fill('Para qué', 'Compras', '.outs');
await tap('Sacar $', '.outs button[type="submit"]');
await sleep(300);
check((await text()).includes('En la caja debería haber'), 'never more than the drawer should hold');
await fill('Cuánto sacas', '5000', '.outs');
await fill('Para qué', 'a', '.outs');
await tap('Sacar $', '.outs button[type="submit"]');
await sleep(300);
check((await text()).includes('Escribe para qué se saca el efectivo'), 'a reason is required');
await tap('Cancelar', '.outs .take button');
await sleep(150);

console.log('Register: void a mistaken one');
await tap('Anular', '.outs .link');
await sleep(150);
await fill('Motivo para anular', 'Se anotó por error', '.outs');
await tap('Anular salida', '.outs button');
await sleep(700);
t = await text();
check(t.includes('Anulada por Luisa') && t.includes('Se anotó por error'), 'the voided salida stays listed, struck, with its reason');
check((await expected()) === before, 'the cash comes back to the expected');

console.log('Register: close the day with a salida');
await tap('Sacar efectivo');
await sleep(150);
await fill('Cuánto sacas', '15000', '.outs');
await tap('Gastos del local', '.outs .chip');
await tap('Sacar $ 15.000', '.outs button');
await sleep(700);
const toCount = await expected();
check(toCount === before - 15000, 'a second salida counts');
await fill('Efectivo contado', String(toCount));
await sleep(100);
check((await text()).includes('Cuadra'), 'counting the expected cash squares');
await tap('Cerrar caja');
await sleep(150);
await tap('Sí, cerrar');
await sleep(800);
t = await text();
check(t.includes('Caja cerrada') && t.includes('Salidas de efectivo') && t.includes('−$ 15.000'), 'the closing shows the salidas');
check(!(await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Sacar efectivo|^Anular$/.test(b.textContent.trim())))), 'a closed day takes and voids nothing');
await shot('3-cerrada', '.closed');

console.log('Owner: Cierres');
await as('admin', '/admin/cierres');
t = await text();
check(t.includes('Salidas: Gastos del local 15.000'), "today's closing lists the salida with its reason");
check(!t.includes('Cigarrillos 20.000'), 'the voided one is not counted');
await shot('4-cierres', '.rows');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
