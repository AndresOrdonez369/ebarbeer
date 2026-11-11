// End-to-end check of phase 7 states in demo mode, at phone size, with headless Edge:
// offline notice and catch-up, the bill in progress surviving a reload, the register noting a
// closed drawer, and the first steps of a brand-new shop.
//   node scripts/e2e-endurecer.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p7-*.png.
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
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e7-')),
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
const shot = async (name) => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate(() => scrollTo(0, 0));
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p7-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};

await page.goto(BASE + '/ingreso');

console.log('Offline');
await as('admin', '/admin');
check(!(await text()).includes('Sin conexión'), 'online: no notice');
await page.setOfflineMode(true);
await sleep(400);
check((await text()).includes('Sin conexión · lo que ves puede estar atrasado'), 'offline: notice under the header');
check((await text()).includes('Hoy en el local'), 'the last figures stay on screen');
await shot('1-sin-conexion');
await page.setOfflineMode(false);
await sleep(600);
check(!(await text()).includes('Sin conexión'), 'back online: notice gone');

console.log('Register: the bill survives a reload');
await as('cashier', '/caja');
await page.evaluate(() => document.querySelector('.lineup button')?.click());
await page.evaluate(() => [...document.querySelectorAll('button.item')].find((b) => b.textContent.trim().startsWith('Corte + barba'))?.click());
await sleep(200);
check((await text()).includes('Cobrar $ 30.000'), 'bill built: Corte + barba');
await page.reload({ waitUntil: 'networkidle0' });
await sleep(900);
check((await text()).includes('Cobrar $ 30.000') && (await page.$$('.bill li')).length === 1, 'after a reload the bill is still there');
await tap('Cobrar $ 30.000');
await sleep(400);
await tap('Exacto');
await tap('Cobrar $ 30.000');
await sleep(1200);
check((await text()).includes('Cobrada'), 'the restored bill can be charged');
await page.reload({ waitUntil: 'networkidle0' });
await sleep(900);
check((await text()).includes('Cuenta vacía'), 'a charged bill does not come back after a reload');
await page.evaluate(() => document.querySelector('.lineup button')?.click());
await page.evaluate(() => [...document.querySelectorAll('button.item')].find((b) => b.textContent.trim().startsWith('Corte'))?.click());
await sleep(200);
await page.setOfflineMode(true);
await sleep(300);
check((await text()).includes('Sin conexión'), 'register shows the offline notice too');
await page.setOfflineMode(false);
await sleep(300);
await tap('Vaciar');
await sleep(200);
await page.reload({ waitUntil: 'networkidle0' });
await sleep(900);
check((await text()).includes('Cuenta vacía'), 'an emptied bill stays empty after a reload');

console.log('Register: closed drawer');
check(!(await text()).includes('Caja de hoy cerrada'), 'before closing: no note');
await as('cashier', '/caja/cierre');
const expected = await page.$eval('.expected .big', (e) => e.textContent.replace(/[^0-9]/g, ''));
await page.evaluate((v) => {
	const el = document.querySelector('input.amt');
	el.value = v;
	el.dispatchEvent(new Event('input', { bubbles: true }));
}, expected);
await tap('Cerrar caja');
await sleep(150);
await tap('Sí, cerrar');
await sleep(800);
await as('cashier', '/caja');
check((await text()).includes('Caja de hoy cerrada a las'), 'after closing, the register says cash now falls outside it');
await shot('2-caja-cerrada');

console.log('A brand-new shop');
await page.evaluate(() => {
	const s = JSON.parse(sessionStorage.getItem('barbeer-demo-state'));
	s.team = s.team.filter((t) => t.role === 'admin');
	s.items = [];
	s.lines = [];
	sessionStorage.setItem('barbeer-demo-state', JSON.stringify(s));
});
await as('admin', '/admin');
let t = await text();
check(t.includes('Primeros pasos') && t.includes('Crea a los barberos') && t.includes('Arma el catálogo') && t.includes('Da los accesos'), 'first steps lead the admin home');
check((await page.$$('.first li.next')).length === 1 && (await page.$eval('.first li.next', (l) => l.textContent)).includes('Crea a los barberos'), 'the next step is marked');
await shot('3-primeros-pasos');
await page.click('.first li.next a');
await sleep(700);
check(page.url().endsWith('/admin/equipo'), 'a step opens its screen');
await as('cashier', '/caja');
t = await text();
check(t.includes('Todavía no hay barberos') && t.includes('El administrador lo agrega en Catálogo'), 'the register explains what is missing');

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
