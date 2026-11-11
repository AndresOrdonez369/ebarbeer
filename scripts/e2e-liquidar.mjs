// End-to-end check of paying barbers at the register ("liquidar"), in demo mode, at phone size:
// the cashier opens Barberos, sees what each one is owed today, pays Kike, and the drawer, the
// barber's own screen and the admin all agree.
//   node scripts/e2e-liquidar.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p8-*.png.
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e8-')),
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
const tap = (label) =>
	page.evaluate((t) => {
		const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
		if (!b) throw new Error('no button ' + t);
		b.click();
	}, label);
const pesos = (s) => Number(String(s).replace(/[^0-9]/g, ''));
const shot = async (name, selector = null) => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate((sel) => (sel ? document.querySelector(sel)?.scrollIntoView({ block: 'center' }) : scrollTo(0, 0)), selector);
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p8-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};
const rowOf = (name) =>
	page.evaluate((n) => {
		const li = [...document.querySelectorAll('.rows li')].find((l) => l.querySelector('.n')?.firstChild?.textContent.trim() === n);
		return li ? li.textContent.replace(/\s+/g, ' ') : null;
	}, name);

await page.goto(BASE + '/ingreso');

console.log('Register: the Barberos tab');
await as('cashier', '/caja');
check((await text()).includes('Barberos'), 'the register has a Barberos tab');
await as('cashier', '/caja/barberos');
let t = await text();
check(t.includes('Por pagar hoy') && t.includes('Kike') && t.includes('le toca'), 'every barber with what he is owed today');
const totalBefore = pesos(await page.$eval('.total .big', (e) => e.textContent));
const kikeRow = await rowOf('Kike');
check(!!kikeRow && /\d+ cortes/.test(kikeRow), `Kike's row shows his cuts (${kikeRow})`);
await shot('1-barberos');

console.log('Register: Kike asks how much he gets');
await page.evaluate(() => [...document.querySelectorAll('.rows li a')].find((a) => a.textContent.includes('Kike'))?.click());
await sleep(900);
t = await text();
check(page.url().includes('/caja/barberos/d-kike') && t.includes('Hoy ·') && t.includes('Le toca'), 'his record opens on today');
const owed = pesos(await page.$eval('.owed .big', (e) => e.textContent));
const items = await page.$$eval('.rows li .earn', (els) => els.map((e) => Number(e.textContent.replace(/[^0-9]/g, ''))));
const bonusText = await page.$eval('.owed .sum', (e) => e.textContent);
const bonus = /bonos \$ ([\d.]+)/.test(bonusText) ? pesos(bonusText.match(/bonos \$ ([\d.]+)/)[1]) : 0;
check(owed > 0 && items.length > 0, `owed today ${owed}, ${items.length} lines of work`);
check(t.includes('Cortes') && t.includes('Servicios') && t.includes('Vendió'), 'clear figures: cuts, services, sold');
check(t.includes('Día de 5') && t.includes('Cumplido hoy'), 'a day bonus met today is added to today');
await shot('2-kike-hoy');
await tap('Semana');
await sleep(700);
t = await text();
check(t.includes('Esta semana') && t.includes('Pagos'), 'week view lists the nights he was already paid');
await tap('Mes');
await sleep(700);
check((await text()).includes('Le toca') || (await text()).includes('Al día'), 'month view');
await tap('Día');
await sleep(700);

console.log('Register: paying him');
await tap('Pagar $');
await sleep(200);
t = await text();
check(t.includes('¿Le entregaste') && t.includes('a Kike en efectivo') && t.includes('Sale del cajón'), 'confirmation says how much, to whom and that it leaves the drawer');
await shot('3-confirmar', '.confirm');
await tap('Sí, pagado');
await sleep(1000);
t = await text();
check(t.includes('Pagado') && t.includes('Enviarle el resumen por WhatsApp'), 'a receipt with WhatsApp summary');
const paidFig = pesos(await page.$eval('.done .paid-fig', (e) => e.textContent));
check(paidFig === owed, `paid exactly what was owed (${paidFig})`);
const wa = await page.$eval('.done a.wa', (a) => decodeURIComponent(a.href));
check(wa.startsWith('https://wa.me/?text=') && wa.includes('Pago a Kike') && wa.includes('Pagado:'), 'the WhatsApp summary is ready');
check((await page.$eval('.owed .label', (e) => e.textContent)) === 'Al día' && pesos(await page.$eval('.owed .big', (e) => e.textContent)) === 0, 'now he is up to date');
await shot('4-pagado');

console.log('Everyone agrees');
await as('cashier', '/caja/barberos');
check((await rowOf('Kike'))?.includes('Pagado'), 'the list shows Kike as paid');
check(pesos(await page.$eval('.total .big', (e) => e.textContent)) === totalBefore - owed, 'what is owed today dropped by that payment');
await as('cashier', '/caja/cierre');
t = await text();
check(t.includes('pagado a barberos') && t.includes(`$ ${owed.toLocaleString('es-CO')}`), 'the closing subtracts the cash paid to barbers');
await shot('5-cierre');
await as('barber', '/barbero');
check((await text()).includes('Ya te pagaron hoy'), 'Kike sees he was paid');

console.log('A new cut after paying');
await as('cashier', '/caja');
await page.evaluate(() => [...document.querySelectorAll('.lineup button')].find((b) => b.textContent.includes('Kike'))?.click());
await page.evaluate(() => [...document.querySelectorAll('button.item')].find((b) => b.textContent.trim().startsWith('Corte') && !b.textContent.includes('+') && !b.textContent.includes('niño'))?.click());
await sleep(200);
await tap('Cobrar $ 20.000');
await sleep(400);
await tap('Exacto');
await tap('Cobrar $ 20.000');
await sleep(1200);
await as('barber', '/barbero');
check((await text()).includes('Por cobrar en caja: $ 10.000'), 'the barber sees the new cut waiting to be collected');
await as('cashier', '/caja/barberos/d-kike');
check(pesos(await page.$eval('.owed .big', (e) => e.textContent)) === 10000, 'the register owes him only the new cut');

console.log('A paid bill cannot be voided');
await as('cashier', '/caja/hoy');
await page.evaluate(() => [...document.querySelectorAll('.sales > li .row')].find((b) => b.textContent.includes('0021'))?.click());
await sleep(300);
await page.evaluate(() => {
	const el = document.querySelector('.reason input');
	el.value = 'Prueba de anulación';
	el.dispatchEvent(new Event('input', { bubbles: true }));
});
await tap('Anular cuenta');
await sleep(600);
check((await text()).includes('A Kike ya se le pagó la comisión de esta cuenta'), 'voiding a bill already paid to the barber is refused');

console.log('After closing the drawer');
await as('cashier', '/caja/cierre');
const exp = await page.$eval('.expected .big', (e) => e.textContent.replace(/[^0-9]/g, ''));
await page.evaluate((v) => {
	const el = document.querySelector('input.amt');
	el.value = v;
	el.dispatchEvent(new Event('input', { bubbles: true }));
}, exp);
await tap('Cerrar caja');
await sleep(150);
await tap('Sí, cerrar');
await sleep(800);
await as('cashier', '/caja/barberos/d-kike');
await tap('Pagar $');
await sleep(150);
await tap('Sí, pagado');
await sleep(800);
check((await text()).includes('La caja de hoy ya está cerrada: págale por transferencia'), 'cash cannot leave a drawer that was already counted');
await tap('Transferencia');
await tap('Pagar $');
await sleep(150);
check((await text()).includes('No toca el efectivo del cajón'), 'a transfer says it does not touch the drawer');
await tap('Sí, pagado');
await sleep(900);
check((await text()).includes('en transferencia'), 'paid by transfer');

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
