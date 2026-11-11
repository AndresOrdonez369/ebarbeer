// End-to-end check of the barber's screens in demo mode, at phone size, with headless Edge.
//   node scripts/e2e-barbero.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p4-*.png.
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
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e4-')),
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
		const b = [...document.querySelectorAll('button, a')].find((x) =>
			x.textContent.replace(/\s+/g, ' ').replace(/^\s*META\s*/, '').trim().startsWith(t)
		);
		if (!b) throw new Error('no button ' + t);
		b.click();
	}, label);
const shot = async (name, selector = null, block = 'start') => {
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate(
		(sel, b) => {
			if (!sel) return scrollTo(0, 0);
			document.querySelector(sel)?.scrollIntoView({ block: b });
			if (b === 'start') scrollBy(0, -12);
		},
		selector,
		block
	);
	await sleep(200);
	await page.screenshot({ path: `${OUT}/p4-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};

await page.goto(BASE + '/ingreso');

console.log('Cashier charges Kike, then Kike sees it');
await as('cashier', '/caja');
await tap('Kike');
await tap('Diseño');
await sleep(100);
await tap('Cobrar $ 8.000');
await sleep(200);
await tap('Exacto');
await tap('Cobrar $ 8.000');
await sleep(900);
check((await text()).includes('Cobrada'), 'cashier charged a Diseño to Kike');

await as('barber', '/barbero');
let t = await text();
check(t.includes('Tus servicios de hoy'), 'barber Hoy shows the services list');
const rows = await page.evaluate(() =>
	[...document.querySelectorAll('.lines li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim())
);
check(rows.length >= 6, `lists every service of the day (${rows.length})`);
check(rows[0]?.includes('Diseño') && rows[0]?.includes('4.000'), 'newest first, with what it leaves him (4.000 of 8.000)');
check(/\d{1,2}:\d{2}/.test(rows[0] ?? ''), 'each service shows its time');
const earned = await page.evaluate(() => document.querySelector('.stats .earn').textContent.replace(/\D/g, ''));
const listed = await page.evaluate(() =>
	[...document.querySelectorAll('.lines li:not(.void) .earn-col b')].reduce((s, b) => s + Number(b.textContent.replace(/\D/g, '')), 0)
);
check(Number(earned) === listed, `"Ganado hoy" equals the sum of the list (${earned} vs ${listed})`);
await shot('0-hoy-arriba');
await shot('1-hoy', '.block');

console.log('Void reaches the barber');
await as('cashier', '/caja/hoy');
await page.evaluate(() => [...document.querySelectorAll('.sales .row')].find((b) => b.textContent.includes('Diseño')).click());
await sleep(200);
await page.type('.reason input', 'Cliente no quiso el diseño');
await tap('Anular cuenta');
await sleep(800);
await as('barber', '/barbero');
const voided = await page.evaluate(() => [...document.querySelectorAll('.lines li.void')].map((li) => li.textContent));
check(voided.some((v) => v.includes('Diseño') && v.includes('Anulado')), 'voided service shows struck through for the barber');
await shot('1b-hoy-anulado', '.lines li.void', 'center');

console.log('History');
await tap('Historial');
await sleep(900);
t = await text();
check(t.includes('Cortes') && t.includes('Ganado') && t.includes('Días'), 'week summary');
const weekRows = await page.evaluate(() => document.querySelectorAll('.rows li').length);
check(weekRows >= 1 && weekRows <= 7, `week shows at most 7 days (${weekRows})`);
await shot('2-semana');
await tap('Mes');
await sleep(900);
const monthRows = await page.evaluate(() => document.querySelectorAll('.rows li').length);
check(monthRows >= weekRows, `month shows at least the week (${monthRows})`);
await shot('2b-mes');
await tap('Todo');
await sleep(1200);
t = await text();
check(t.includes('Desde') && /promedio \d+ cortes/.test(t), 'all-time summary since he started');
const monthsRows = await page.evaluate(() => [...document.querySelectorAll('.rows li .when')].map((e) => e.textContent));
check(monthsRows.length >= 12 && /\d{4}/.test(monthsRows[0] ?? ''), `all-time rows are months (${monthsRows.length})`);
await shot('3-todo');

console.log('Goals');
await tap('Metas');
await sleep(900);
t = await text();
check(t.includes('Jarra de hoy') && t.includes('Semana fuerte') && t.includes('Mes de oro'), 'daily mug and active bonuses');
check(/Vas \d+ cortes de 40 cortes/.test(t), 'weekly goal in cuts');
check(t.includes('$ 50.000 de premio') && t.includes('+5% sobre tu comisión'), 'rewards spelled out');
check(t.includes('Bonos ganados'), 'awards listed');
check(t.includes('Día de 5') && t.includes('Cumplida'), 'a met goal shows as done');
check(/Vas \$ [\d.]+ en ventas de \$ 3\.500\.000/.test(t), 'money goal says it measures sales');
const awardDates = await page.evaluate(() => [...document.querySelectorAll('.awards li')].map((li) => li.textContent.replace(/\s+/g, ' ')));
check(
	awardDates.filter((x) => x.includes('Semana fuerte')).every((x) => /Semana \d+ de \w+ – \d+ de \w+/.test(x)) &&
		awardDates.filter((x) => x.includes('Mes de oro')).every((x) => /[A-Z][a-z]+ \d{4}/.test(x)),
	`awards dated by their own period (${awardDates.length} awards)`
);
await shot('4-metas');
await shot('5-metas-ganados', '.awards', 'center');

console.log('Barber cannot reach the register');
await page.goto(BASE + '/caja', { waitUntil: 'networkidle0' });
await sleep(700);
check(new URL(page.url()).pathname === '/barbero', 'barber is sent back to his own section');

console.log('Desktop');
// A desktop viewport reloads the page in puppeteer; the demo state survives in sessionStorage.
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
for (const [path, file, tab] of [
	['/barbero', 'desktop-barbero.png', null],
	['/barbero/historial', 'desktop-historial.png', 'Todo'],
	['/barbero/metas', 'desktop-metas.png', null]
]) {
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
	if (tab) {
		await tap(tab);
		await sleep(1200);
	}
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.evaluate(() => scrollTo(0, 0));
	await sleep(200);
	await page.screenshot({ path: `${OUT}/${file}` });
}
check(new URL(page.url()).pathname === '/barbero/metas', 'desktop routes open');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
