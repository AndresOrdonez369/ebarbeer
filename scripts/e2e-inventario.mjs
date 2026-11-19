// End-to-end check of inventory in demo mode, at phone size, with headless Edge:
// the admin sees what is running out, records arrivals and counts, creates a product with stock;
// the register sees what is left, and a sale and its void move the count.
//   node scripts/e2e-inventario.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p8-*.png.
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
const fill = (label, value) =>
	page.evaluate(
		(l, v) => {
			const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(l));
			const el = lab?.querySelector('input, textarea');
			if (!el) throw new Error('no field labelled ' + l);
			el.value = v;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		},
		label,
		value
	);
const shot = async (name, selector = null) => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate((sel) => {
		if (!sel) return scrollTo(0, 0);
		document.querySelector(sel)?.scrollIntoView({ block: 'start' });
		scrollBy(0, -12);
	}, selector);
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p8-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};
const itemButton = (name) =>
	page.evaluate((n) => {
		const b = [...document.querySelectorAll('button.item')].find((x) => x.querySelector('.name')?.firstChild?.textContent.trim() === n);
		return b ? b.textContent.replace(/\s+/g, ' ').trim() : null;
	}, name);

await page.goto(BASE + '/ingreso');
await page.evaluate(() => localStorage.clear());

console.log('Admin: what is running out');
await as('admin', '/admin');
let t = await text();
check(t.includes('Por acabarse') && t.includes('Agua (4)') && t.includes('Aceite de barba (2)'), 'En vivo warns what is running out');
await shot('1-en-vivo', '.low');
await as('admin', '/admin/catalogo');
t = await text();
check(t.includes('Por acabarse') && t.includes('Quedan 4') && t.includes('Quedan 48'), 'catalog lists what is left of each');
await shot('2-catalogo');

console.log('Admin: arrivals and counts');
await as('admin', '/admin/catalogo/d-item-6');
t = await text();
check(t.includes('Inventario') && t.includes('48 unidades') && t.includes('Conteo inicial'), 'beer shows 48 units and its first count');
await fill('Cuántas llegaron', '24');
await fill('Nota', 'Pedido del jueves');
await tap('Sumar 24');
await sleep(500);
t = await text();
check(t.includes('Sumadas 24 unidades. Ahora quedan 72.') && t.includes('Llegó mercancía') && t.includes('Pedido del jueves'), 'an arrival adds and is listed with its note');
await tap('Conté y hay otra cantidad');
await sleep(100);
await fill('Cuántas hay', '70');
await sleep(100);
check((await text()).includes('faltan 2 frente a lo que dice la app'), 'a count says how far it is from the app');
await tap('Guardar conteo');
await sleep(500);
t = await text();
check(t.includes('Conteo guardado: 70 unidades.') && t.includes('= 70'), 'the count replaces the figure');
await shot('3-cerveza', '.stock');

console.log('Admin: a new product with stock');
await as('admin', '/admin/catalogo/nuevo');
await tap('Productos', '[role="radio"]');
await sleep(100);
await fill('Nombre', 'Cadena de acero');
await fill('Precio', '45000');
await fill('Comisión', '0');
await fill('Cantidad en inventario', '3');
await fill('Avisar cuando queden', '1');
await tap('Agregar', 'button[type="submit"]');
await sleep(700);
t = await text();
check(t.includes('Agregado con 3 en inventario') && t.includes('3 unidades'), 'a new product starts with its stock');
await shot('4-nuevo');

console.log('Register: what is left, and a sale moves it');
await as('cashier', '/caja');
await tap('Igual que la última vez').catch(() => {});
await sleep(100);
await tap('Abrir caja con').catch(() => {});
await sleep(500);
await tap('Bebidas', '[role="tab"]');
await sleep(200);
check((await itemButton('Agua'))?.includes('Quedan 4'), 'water shows it is running out');
check(!(await itemButton('Cerveza'))?.includes('Quedan'), 'beer, well stocked, shows nothing');
await shot('5-caja-bebidas', '.tabs');
await tap('Agua', 'button.item');
await tap('Agua', 'button.item');
await tap('Agua', 'button.item');
await sleep(150);
await tap('Cobrar $ 7.500');
await sleep(300);
await tap('Exacto');
await sleep(100);
await tap('Cobrar $ 7.500');
await sleep(1200);
await tap('Nueva cuenta');
await sleep(600);
await tap('Bebidas', '[role="tab"]');
await sleep(200);
check((await itemButton('Agua'))?.includes('Quedan 1'), 'after selling 3 waters: 1 left');

console.log('Register: a void puts them back');
await as('cashier', '/caja/hoy');
await page.evaluate(() => document.querySelector('.sales > li .row').click());
await sleep(300);
await page.evaluate(() => {
	const el = document.querySelector('.sales > li:first-child .reason input');
	el.value = 'Se cobró por error';
	el.dispatchEvent(new Event('input', { bubbles: true }));
});
await tap('Anular cuenta');
await sleep(700);
await as('cashier', '/caja');
await tap('Bebidas', '[role="tab"]');
await sleep(200);
check((await itemButton('Agua'))?.includes('Quedan 4'), 'voiding the bill brings the waters back');
await as('admin', '/admin/catalogo/d-item-9');
t = await text();
check(t.includes('Cuenta anulada') && t.includes('Vendida'), 'the water lists the sale and the void');
await shot('6-agua', '.stock');

console.log('Admin: stop keeping inventory');
await tap('Dejar de llevar inventario');
await sleep(100);
await tap('Sí, dejar de llevar');
await sleep(500);
t = await text();
check(t.includes('Ya no se lleva inventario') && t.includes('Empezar inventario'), 'inventory can be turned off and back on');

console.log('Register: selling past the count never blocks');
await as('cashier', '/caja');
await tap('Productos', '[role="tab"]');
await sleep(200);
for (let i = 0; i < 3; i++) await tap('Aceite de barba', 'button.item');
await sleep(150);
await tap('Cobrar $ 90.000');
await sleep(300);
await tap('Exacto');
await sleep(100);
await tap('Cobrar $ 90.000');
await sleep(1200);
await tap('Nueva cuenta');
await sleep(600);
await tap('Productos', '[role="tab"]');
await sleep(200);
check((await itemButton('Aceite de barba'))?.includes('Agotado · 1 de más'), 'selling 3 of 2 goes through and shows 1 too many');
await as('admin', '/admin');
check((await text()).includes('Aceite de barba (agotado)'), 'En vivo says it is out');
await as('admin', '/admin/catalogo/d-item-11');
check((await text()).includes('1 de más'), 'the history shows the units sold past the count');

console.log('Admin: a product moved to Servicios drops its inventory');
await as('admin', '/admin/catalogo/d-item-6');
await tap('Servicios', '[role="radio"]');
await sleep(100);
check((await text()).includes('al guardar se borran sus 70 unidades'), 'warns before moving it');
await tap('Guardar', 'button[type="submit"]');
await sleep(700);
await tap('Bebidas', '[role="radio"]');
await sleep(100);
await tap('Guardar', 'button[type="submit"]');
await sleep(700);
check((await text()).includes('Todavía no llevas inventario'), 'back in Bebidas it starts without inventory');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
