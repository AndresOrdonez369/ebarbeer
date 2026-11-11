// End-to-end check of the register in demo mode, at phone size, with headless Edge.
//   node scripts/e2e-caja.mjs [baseUrl]
// Saves a screenshot per step in .impeccable/review/p2-*.png and fails loudly on any wrong value.
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5174';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e-')),
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
// textContent, not innerText: innerText applies CSS uppercase.
const text = () => page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
const tap = (label) =>
	page.evaluate((t) => {
		const b = [...document.querySelectorAll('button, a')].find((x) =>
			x.textContent.replace(/\s+/g, ' ').replace(/^\s*META\s*/, '').trim().startsWith(t)
		);
		if (!b) throw new Error('no button ' + t);
		b.click();
	}, label);
// Scrolls the state a capture claims into view (the sticky Cobrar bar and the tab bar cover the
// bottom of the screen, so a plain screenshot of the top would not show it), then settles motion.
const shot = async (name, selector = null, block = 'start') => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	if (selector) {
		await page.evaluate(
			(sel, b) => {
				const el = typeof sel === 'string' ? document.querySelector(sel) : null;
				el?.scrollIntoView({ block: b });
				if (b === 'start') scrollBy(0, -12);
			},
			selector,
			block
		);
	} else {
		await page.evaluate(() => scrollTo(0, 0));
	}
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p2-${name}.png` });
};
const desktopShot = async (file, selector = null) => {
	await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
	await sleep(300);
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	if (selector) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), selector);
	await sleep(200);
	await page.screenshot({ path: `${OUT}/${file}` });
	await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	await sleep(300);
};

await page.goto(BASE + '/ingreso');
await page.evaluate(() => {
	sessionStorage.setItem('barbeer-demo-role', 'cashier');
	localStorage.clear();
});
await page.goto(BASE + '/caja', { waitUntil: 'networkidle0' });
await sleep(1200);

console.log('Cash with change');
await tap('Kike');
await tap('Corte + barba');
await tap('Bebidas');
await sleep(80);
await tap('Cerveza 6');
await tap('Cerveza 6');
await sleep(150);
check((await text()).includes('Cobrar $ 42.000'), 'bill totals $ 42.000');
await shot('1-cuenta');
await tap('Cobrar $ 42.000');
await sleep(200);
check((await text()).includes('Total a pagar'), 'payment step opens');
await tap('50.000');
await sleep(100);
check((await text()).includes('Vueltas $ 8.000'), 'change is $ 8.000');
await shot('2-pago');
await tap('Cobrar $ 42.000');
await sleep(900);
let t = await text();
check(t.includes('Cobrada') && t.includes('N.º 0024'), 'charged with receipt 0024');
check(/Entrega de vueltas\s*\$ 8\.000/.test(t), 'done screen repeats the change');
await sleep(800);
await shot('3-listo');
await tap('Nueva cuenta');
await sleep(400);
check((await text()).includes('Cuenta vacía'), 'back to an empty bill');
check((await text()).includes('6/8'), "Kike's mug now shows 6/8");

console.log('Mixed payment');
await tap('Mono');
await tap('Corte 20');
await tap('Productos');
await sleep(80);
await tap('Cera mate');
await sleep(100);
await tap('Cobrar $ 45.000');
await sleep(200);
await tap('Mixto');
await sleep(100);
await page.evaluate(() => {
	const inputs = [...document.querySelectorAll('.split input')];
	const set = (el, v) => {
		el.value = v;
		el.dispatchEvent(new Event('input', { bubbles: true }));
	};
	set(inputs[0], '20000');
});
await sleep(100);
check((await text()).includes('Faltan $ 25.000'), 'mixed shows what is missing');
await page.evaluate(() => [...document.querySelectorAll('.restbtn')][1].click());
await sleep(100);
check((await text()).includes('Suma exacta'), '"Resto" completes the transfer part');
await shot('4-mixto');
await tap('Cobrar $ 45.000');
await sleep(900);
check((await text()).includes('N.º 0025'), 'mixed bill charged as 0025');
await tap('Nueva cuenta');
await sleep(300);

console.log('Hold and resume');
await tap('Dago');
await tap('Barba');
await sleep(100);
await tap('Poner en espera');
await sleep(150);
t = await text();
check(t.includes('En espera') && t.includes('Cuenta vacía'), 'bill parked and register cleared');
await shot('5-espera');
await page.evaluate(() => document.querySelector('.chips button').click());
await sleep(150);
check((await text()).includes('Cobrar $ 12.000'), 'held bill resumed');
await tap('Vaciar');
await sleep(100);

console.log('Offline');
await tap('Jota');
await tap('Corte 20');
await sleep(100);
await page.setOfflineMode(true);
await tap('Cobrar $ 20.000');
await sleep(200);
await tap('Exacto');
await tap('Cobrar $ 20.000');
await sleep(900);
t = await text();
check(t.includes('Por enviar') && t.includes('No la cobres de nuevo'), 'offline bill queued, not lost');
await tap('Nueva cuenta');
await sleep(300);
t = await text();
check(t.includes('1 cuenta por enviar'), 'queue banner visible');
check(t.includes('2/8'), "Jota's mug counts the queued cut (2/8)");
await shot('6-sin-conexion');
await page.setOfflineMode(false);
await page.evaluate(() => dispatchEvent(new Event('online')));
await sleep(1500);
check(!(await text()).includes('por enviar'), 'queue drained when back online');

console.log('Hoy and void');
// Client-side navigation: a reload would wipe the in-memory demo data.
await page.evaluate(() => document.querySelector('nav a[href="/caja/hoy"]').click());
await sleep(800);
t = await text();
check(t.includes('N.º 0026') && t.includes('N.º 0024'), 'today lists the new bills');
await shot('7-hoy');
await page.evaluate(() => {
	const row = [...document.querySelectorAll('.sales .row')].find((b) => b.textContent.includes('0024'));
	row.click();
});
await sleep(150);
await tap('Anular cuenta');
await sleep(150);
check((await text()).includes('Escribe el motivo'), 'void requires a reason');
await page.type('.reason input', 'Cliente pidió cambio');
await tap('Anular cuenta');
await sleep(900);
t = await text();
check(
	await page.evaluate(() =>
		[...document.querySelectorAll('.sales > li')].some((li) => li.classList.contains('void') && li.textContent.includes('0024'))
	),
	'bill 0024 shows as voided'
);
await shot('8-anulada');

console.log('Customer and WhatsApp receipt');
await page.evaluate(() => document.querySelector('nav a[href="/caja"]').click());
await sleep(600);
await tap('Kike');
await tap('Corte 20');
await sleep(100);
await tap('Cobrar $ 20.000');
await sleep(200);
const typePhone = async (v) => {
	await page.evaluate((val) => {
		const el = document.querySelector('.cust input[type="tel"]');
		el.value = val;
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}, v);
	await sleep(450);
};
await typePhone('300 55');
await tap('Exacto');
await sleep(100);
check(await page.evaluate(() => document.querySelector('.go').disabled), 'incomplete WhatsApp blocks charging');
await typePhone('0001234567');
check((await text()).includes('no parece válido'), 'invalid WhatsApp is explained');
await shot('9b-cliente-invalido', '.cust');
await typePhone('5550147');
check((await text()).includes('Andrés Pérez'), 'known customer is suggested by digits');
await page.evaluate(() => document.querySelector('.matches button').click());
await sleep(150);
check((await text()).includes('Ya lo había aceptado'), 'returning customer shows recorded promo consent');
await shot('9-cliente', '.cust');
await tap('Cobrar $ 20.000');
await sleep(900);
check(
	await page.evaluate(
		() => JSON.parse(sessionStorage.getItem('barbeer-demo-state')).customers.find((c) => c.phone === '+573005550147').promo === true
	),
	'charging without touching the box keeps recorded consent'
);
const wa = await page.evaluate(() => document.querySelector('a.wa')?.getAttribute('href') ?? '');
const msg = decodeURIComponent(wa.split('text=')[1] ?? '');
check(wa.startsWith('https://wa.me/573005550147?text='), 'WhatsApp link goes to the customer number');
check(/Boleta N\.º 0027/.test(msg) && msg.includes('Gracias, Andrés.') && msg.includes('Te atendió Kike'), 'message carries bill, name and barber');
const receiptPath = await page.evaluate(() => document.querySelector('a.view').getAttribute('href'));
check(msg.includes(receiptPath), 'message links to the public receipt');
await shot('10-enviar');

await page.goto(BASE + receiptPath, { waitUntil: 'networkidle0' });
await sleep(600);
t = await text();
check(t.includes('Boleta N.º 0027') && t.includes('Te atendió Kike') && t.includes('Gracias, Andrés'), 'public receipt shows the bill');
check(!t.includes('5550147'), 'public receipt never shows the phone');
await shot('11-boleta-publica');
await desktopShot('desktop-boleta-publica.png');
await page.goto(BASE + '/b/demo0000000000000000000000000022', { waitUntil: 'networkidle0' });
await sleep(500);
check((await text()).includes('ANULADA'), 'voided receipt is stamped');
await shot('12-boleta-anulada');
await page.goto(BASE + '/b/nope', { waitUntil: 'networkidle0' });
await sleep(500);
check((await text()).includes('Boleta no encontrada'), 'unknown token explains itself');
await shot('12b-boleta-no-encontrada');

console.log('Attach customer after charging');
await page.goto(BASE + '/caja/hoy', { waitUntil: 'networkidle0' });
await sleep(800);
await page.evaluate(() => [...document.querySelectorAll('.sales .row')].find((b) => b.textContent.includes('0025')).click());
await sleep(200);
await page.evaluate(() => {
	const f = document.querySelector('.receipt form');
	const [p, n] = f.querySelectorAll('input');
	p.value = '311 444 5566';
	p.dispatchEvent(new Event('input', { bubbles: true }));
	n.value = 'Mateo';
	n.dispatchEvent(new Event('input', { bubbles: true }));
});
await tap('Guardar número');
await sleep(600);
const wa2 = await page.evaluate(() => document.querySelector('.receipt a.wa')?.getAttribute('href') ?? '');
check(wa2.startsWith('https://wa.me/573114445566?text='), 'number added in Hoy enables the receipt');
await shot('13-hoy-boleta', '.sales > li .detail', 'center');

console.log('Receipt template');
await page.evaluate(() => sessionStorage.setItem('barbeer-demo-role', 'admin'));
await page.goto(BASE + '/admin/boleta', { waitUntil: 'networkidle0' });
await sleep(700);
await page.evaluate(() => {
	const ta = document.querySelector('textarea');
	ta.value = 'Hola desde {local}. Boleta {numero}: {enlace}';
	ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(150);
check((await text()).includes('Hola desde Bar Beer. Boleta 0147'), 'preview follows the template');
await shot('14-plantilla', 'textarea');
await shot('14b-plantilla-vista-previa', '.bubble', 'center');
// Typing on a phone: about 480 px of screen left above the keyboard, field focused.
await page.setViewport({ width: 375, height: 480, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluate(() => {
	const ta = document.querySelector('textarea');
	ta.focus();
	ta.scrollIntoView({ block: 'start' });
	scrollBy(0, -40);
});
await sleep(200);
check(
	await page.evaluate(() => {
		const r = document.querySelector('.bubble').getBoundingClientRect();
		return r.top < innerHeight && r.bottom > 0;
	}),
	'preview is in view while typing with the keyboard open'
);
await page.screenshot({ path: `${OUT}/p2-14c-plantilla-escribiendo.png` });
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await sleep(200);
await tap('Guardar plantilla');
await sleep(500);
check((await text()).includes('Guardada'), 'template saved');
// Switching to a desktop viewport reloads the page in puppeteer, so this capture comes after saving.
await desktopShot('desktop-plantilla.png', 'textarea');
await page.evaluate(() => sessionStorage.setItem('barbeer-demo-role', 'cashier'));
await page.goto(BASE + '/caja/hoy', { waitUntil: 'networkidle0' });
await sleep(800);
await page.evaluate(() => [...document.querySelectorAll('.sales .row')].find((b) => b.textContent.includes('0027')).click());
await sleep(300);
const wa3 = await page.evaluate(() => document.querySelector('.receipt a.wa')?.getAttribute('href') ?? '');
check(decodeURIComponent(wa3).includes('Hola desde Bar Beer. Boleta 0027'), 'new template used for the next send' + (decodeURIComponent(wa3).includes('Hola desde') ? '' : ' [got: ' + decodeURIComponent(wa3).slice(0, 120) + ']'));

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
