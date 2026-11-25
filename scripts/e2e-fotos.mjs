// End-to-end check of the customer photos after a cut, in demo mode, at phone size, with headless
// Edge: the barber needs consent, takes four photos (shrunk on the phone), saves a note, sees the
// history; the last 3 visits keep their photos; without signal the visit waits and goes up by
// itself; the owner sees the space used and removes a customer's photos on request.
//   node scripts/e2e-fotos.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p11-*.png.
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
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e11-')),
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
const tick = (label) =>
	page.evaluate((l) => {
		const lab = [...document.querySelectorAll('label.check')].find((x) => x.textContent.trim().startsWith(l));
		if (!lab) throw new Error('no checkbox ' + l);
		lab.querySelector('input').click();
	}, label);
// A 12-megapixel portrait "photo" drawn in the page, given to the camera input of an angle.
const shoot = (angle, hue = 20) =>
	page.evaluate(
		async (a, h) => {
			const c = document.createElement('canvas');
			c.width = 3024;
			c.height = 4032;
			const g = c.getContext('2d');
			const grad = g.createLinearGradient(0, 0, 3024, 4032);
			grad.addColorStop(0, `hsl(${h} 40% 30%)`);
			grad.addColorStop(1, `hsl(${h + 40} 30% 12%)`);
			g.fillStyle = grad;
			g.fillRect(0, 0, 3024, 4032);
			for (let i = 0; i < 400; i++) {
				g.fillStyle = `hsl(${(h + i * 7) % 360} 50% ${20 + (i % 50)}%)`;
				g.beginPath();
				g.arc((i * 977) % 3024, (i * 1471) % 4032, 30 + (i % 90), 0, 7);
				g.fill();
			}
			const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
			const file = new File([blob], `IMG_${a}.jpg`, { type: 'image/jpeg' });
			const input = [...document.querySelectorAll('input[type=file]')].find((x) => x.getAttribute('aria-label').endsWith(a));
			if (!input) throw new Error('no camera for ' + a);
			const dt = new DataTransfer();
			dt.items.add(file);
			input.files = dt.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
			return blob.size;
		},
		angle,
		hue
	);
const shot = async (name) => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await sleep(250);
	await page.screenshot({ path: `${OUT}/p11-${name}.png`, fullPage: true });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(800);
};
const waitFor = async (cond, ms = 6000) => {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await page.evaluate(cond)) return true;
		await sleep(150);
	}
	return false;
};

await page.goto(BASE + '/ingreso');
await page.evaluate(() => localStorage.clear());

console.log('Barber: Clientes');
await as('barber', '/barbero/clientes');
let t = await text();
check(t.includes('Clientes') && t.includes('Últimos con registro') && t.includes('Andrés Pérez'), 'the tab lists the latest customers with a record');
check(t.includes('···0147') && !t.includes('300 555 0147'), 'a barber sees only the end of the number');

console.log('Barber: a new customer, consent, four photos');
await tap('Fotos de un corte');
await sleep(600);
check(await page.evaluate(() => document.querySelector('fieldset.shots').disabled), 'the cameras wait for the consent');
await tap('Guardar visita');
await sleep(200);
check((await text()).includes('Escribe el WhatsApp del cliente'), 'the WhatsApp is required');
await fill('WhatsApp del cliente', '315 444 1212');
await fill('Nombre', 'Camilo Ruiz');
await sleep(700);
check((await text()).includes('Cliente nuevo.'), 'an unknown number reads as a new customer');
await tick('El cliente autoriza');
await sleep(100);
check(await page.evaluate(() => !document.querySelector('fieldset.shots').disabled), 'consent opens the cameras');
check((await text()).includes('Es menor de edad'), 'the guardian box appears once consent is given');
let original = 0;
for (const [i, a] of ['Frente', 'Izquierda', 'Derecha', 'Atrás'].entries()) original = Math.max(original, await shoot(a, 20 + i * 60));
check(await waitFor(() => document.querySelectorAll('.slot.filled img').length === 4), `four previews (originals up to ${Math.round(original / 1024)} kB)`);
check((await text()).includes('Fotos · 4 de 4'), 'the count says 4 of 4');
await page.evaluate(() => document.querySelector('button[aria-label="Quitar foto: Derecha"]').click());
await sleep(100);
check(await page.evaluate(() => document.querySelectorAll('.slot.filled').length === 3), 'a photo can be removed');
await shoot('Derecha', 200);
await waitFor(() => document.querySelectorAll('.slot.filled').length === 4);
await fill('Nota del corte', 'Degradado bajo, 1 a los lados. Barba perfilada.');
await shot('1-tomar');
await tap('Guardar visita');
check(await waitFor(() => location.pathname.startsWith('/barbero/clientes/') && !location.pathname.endsWith('nueva')), 'saving opens the customer');
await sleep(600);
t = await text();
check(t.includes('Visita guardada.') && t.includes('Camilo Ruiz') && t.includes('···1212'), 'the customer page confirms, with the masked number');
check(t.includes('autorizó sus fotos') && t.includes('Degradado bajo, 1 a los lados') && t.includes('Tú'), 'the visit shows the note and who cut');
check(await page.evaluate(() => document.querySelectorAll('.thumbs .thumb img').length === 4), 'four thumbnails');
const sizes = await page.evaluate(async () => {
	document.querySelector('.thumbs').click();
	await new Promise((r) => setTimeout(r, 400));
	const big = [...document.querySelectorAll('.big img')];
	await Promise.all(big.map((i) => i.decode().catch(() => {})));
	const thumbs = [...document.querySelectorAll('.thumbs img')];
	return {
		big: big.map((i) => [i.naturalWidth, i.naturalHeight]),
		bytes: big.map((i) => Math.round((i.src.length * 3) / 4)),
		thumb: thumbs.map((i) => Math.max(i.naturalWidth, i.naturalHeight)),
		thumbBytes: thumbs.map((i) => Math.round((i.src.length * 3) / 4))
	};
});
check(sizes.big.length === 4 && sizes.big.every(([w, h]) => h === 1024 && w === 768), `the large photos are 768×1024 (${JSON.stringify(sizes.big[0])})`);
check(sizes.bytes.every((b) => b < 200_000), `each large photo is small (${sizes.bytes.map((b) => Math.round(b / 1024) + ' kB').join(', ')})`);
check(sizes.thumb.every((s) => s === 320) && sizes.thumbBytes.every((b) => b < 45_000), `thumbnails are 320 px (${sizes.thumbBytes.map((b) => Math.round(b / 1024) + ' kB').join(', ')})`);
await shot('2-cliente');

console.log('Barber: the last 3 visits keep their photos');
const customerUrl = await page.evaluate(() => location.pathname);
for (let i = 0; i < 3; i++) {
	await tap('Fotos de hoy');
	await sleep(700);
	t = await text();
	if (i === 0) check(t.includes('Camilo Ruiz') && t.includes('Autorizó guardar sus fotos.') && !t.includes('El cliente autoriza'), 'a returning customer is not asked again');
	await shoot('Frente', 90 + i * 30);
	await waitFor(() => document.querySelectorAll('.slot.filled').length === 1);
	await fill('Nota del corte', `Visita ${i + 2}`);
	await tap('Guardar visita');
	await waitFor(() => !location.pathname.endsWith('nueva'));
	await sleep(700);
}
t = await text();
check(t.includes('Visita 4') && t.includes('Fotos borradas. Se guardan las de las últimas 3 visitas.'), 'the fourth visit clears the photos of the oldest one');
check(t.includes('Degradado bajo, 1 a los lados'), 'its note stays');

console.log('Barber: without signal');
await page.goto(BASE + '/barbero/clientes/nueva', { waitUntil: 'networkidle0' });
await sleep(600);
await fill('WhatsApp del cliente', '3201234567');
await sleep(600);
await tick('El cliente autoriza');
await shoot('Frente', 300);
await waitFor(() => document.querySelectorAll('.slot.filled').length === 1);
await page.setOfflineMode(true);
await tap('Guardar visita');
check(await waitFor(() => location.search.includes('pendiente')), 'without signal the visit stays on the phone');
await sleep(400);
t = await text();
check(t.includes('Visita guardada en el teléfono') && t.includes('1 visita por subir'), 'the list says it waits');
await shot('3-sin-senal');
await page.setOfflineMode(false);
check(await waitFor(() => !document.body.textContent.includes('visita por subir'), 8000), 'it goes up by itself when the signal returns');
await sleep(300);
await page.evaluate(() => {
	const s = document.querySelector('input[type=search]');
	s.value = '4567';
	s.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(900);
check((await text()).includes('···4567'), 'and the customer is listed');

console.log('Owner: space and removing photos');
await as('admin', '/admin/clientes');
t = await text();
check(/Fotos de clientes: [\d,]+ (kB|MB) de 1 GB/.test(t), 'the owner sees the space the photos use');
check(t.includes('visitas de'), 'with visits and customers');
await shot('4-espacio');
await page.evaluate(() => [...document.querySelectorAll('li a')].find((a) => a.textContent.includes('Camilo Ruiz')).click());
await sleep(900);
t = await text();
check(t.includes('Camilo Ruiz') && t.includes('315') && t.includes('Autorizó guardar sus fotos el'), 'the owner sees the full number and the consent');
await tap('Borrar fotos del cliente');
await sleep(150);
check((await text()).includes('No se puede deshacer'), 'removing asks first, in red');
await tap('Borrar fotos', '.confirm button');
await sleep(900);
t = await text();
check(t.includes('Fotos borradas. Sus visitas y notas siguen') && t.includes('No ha autorizado fotos'), 'photos and consent are gone, visits stay');
check(await page.evaluate(() => document.querySelectorAll('.thumbs img').length === 0), 'no photo left');
await shot('5-borrar');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
