// End-to-end check of phase 6 (money) in demo mode, at phone size, with headless Edge:
// cash closing, closings history, reports with CSV, bonus rules, barber payouts and voids.
//   node scripts/e2e-dinero.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p6-*.png.
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5174';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });
const DOWNLOADS = mkdtempSync(join(tmpdir(), 'barbeer-csv-'));

const browser = await puppeteer.launch({
	executablePath: EDGE,
	headless: true,
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e6-')),
	args: ['--no-first-run', '--no-default-browser-check']
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });
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
const tapAria = (label) =>
	page.evaluate((t) => {
		const b = document.querySelector(`[aria-label="${t}"]`);
		if (!b) throw new Error('no control ' + t);
		b.click();
	}, label);
const setField = (selector, value) =>
	page.evaluate(
		(sel, v) => {
			const el = document.querySelector(sel);
			if (!el) throw new Error('no field ' + sel);
			if (el.type === 'checkbox') {
				if (el.checked !== v) el.click();
				return;
			}
			el.value = v;
			el.dispatchEvent(new Event('input', { bubbles: true }));
			el.dispatchEvent(new Event('change', { bubbles: true }));
		},
		selector,
		value
	);
const fieldByLabel = (label) =>
	page.evaluate((l) => {
		const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(l));
		const el = lab?.querySelector('input, select, textarea');
		if (!el) throw new Error('no field labelled ' + l);
		el.setAttribute('data-e2e', l);
		return `[data-e2e="${l}"]`;
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
	await page.screenshot({ path: `${OUT}/p6-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};
const pesos = (s) => Number(String(s).replace(/[^0-9]/g, ''));

await page.goto(BASE + '/ingreso');

console.log('Register: close the day');
await as('cashier', '/caja/cierre');
let t = await text();
check(t.includes('Debería haber en efectivo') && t.includes('Hoy ·'), 'closing screen shows what the drawer should hold');
const expected = pesos(await page.$eval('.expected .big', (e) => e.textContent));
check(expected > 0, `expected cash is a figure (${expected})`);
await shot('1-cierre');
await tap('Cerrar caja');
await sleep(200);
check((await text()).includes('Escribe cuánto efectivo contaste'), 'closing without counting is refused');
const counted = await fieldByLabel('Efectivo contado');
await setField(counted, String(expected));
await sleep(150);
check((await page.$eval('.diff', (e) => e.textContent.trim())) === 'Cuadra', 'counting the exact amount says it balances');
await setField(counted, String(expected - 2000));
await sleep(150);
check((await page.$eval('.diff', (e) => e.textContent.trim())) === 'Faltan $ 2.000', 'a short drawer says how much is missing');
check((await page.$eval(counted, (e) => e.value)).includes('.'), 'counted cash is written with thousands separators');
await setField(await fieldByLabel('Nota'), 'Se dio cambio de más');
await shot('2-cierre-falta', '.form', 'center');
await tap('Cerrar caja');
await sleep(200);
check((await text()).includes('Después no se puede cambiar'), 'closing asks for confirmation first');
await shot('3-cierre-confirmar', '.confirm', 'center');
await tap('Sí, cerrar');
await sleep(800);
t = await text();
check(t.includes('Caja cerrada') && t.includes('Faltan $ 2.000') && t.includes('Cerró Luisa'), 'closed: summary with difference and who closed');
check(t.includes('Se dio cambio de más'), 'the note is kept');
await shot('4-cierre-hecho');
await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);
check((await text()).includes('Caja cerrada'), 'the closing survives a reload');

console.log('Admin: closings history');
await as('admin', '/admin/mas');
for (const name of ['Reportes y CSV', 'Pagos a barberos', 'Bonos', 'Historial de cierres', 'Anulaciones'])
	check(!!(await page.$(`a[href^="/admin/"]`)) && (await text()).includes(name), `Más lists ${name}`);
await tap('Historial de cierres');
await sleep(900);
t = await text();
check(page.url().endsWith('/admin/cierres') && t.includes('Faltó $ 2.000') && t.includes('Se dio cambio de más'), 'today’s closing heads the history');
check(t.includes('Diferencia neta') && t.includes('No cuadraron'), 'history totals the month');
await shot('5-cierres');
await tapAria('Periodo anterior');
await sleep(500);
check((await page.$$('.rows li')).length > 10, 'previous month has its closings');
const moreActive = await page.$eval('.tabbar a[aria-current="page"], nav a[aria-current="page"]', (a) => a.textContent.trim()).catch(() => '');
check(/Más/i.test(moreActive), `Más stays lit on a money page (${moreActive})`);

console.log('Admin: reports and CSV');
await as('admin', '/caja/hoy');
const todayTotal = pesos(await page.$eval('.big', (e) => e.textContent));
await as('admin', '/admin/reportes');
t = await text();
check(t.includes('Vendido') && t.includes('Por barbero') && t.includes('Servicios') && t.includes('Bebidas'), 'month report with breakdowns');
check(t.includes('Por día'), 'month report lists each day');
await shot('6-reporte-mes');
await tap('Día');
await sleep(700);
const dayTotal = pesos(await page.$eval('.total .big', (e) => e.textContent));
check(dayTotal === todayTotal, `today’s report matches the register (${dayTotal} = ${todayTotal})`);
check(!(await text()).includes('Por día'), 'a single day has no per-day list');
const nextDisabled = await page.$eval('[aria-label="Periodo siguiente"]', (b) => b.disabled);
check(nextDisabled, 'cannot step into the future');
await tapAria('Periodo anterior');
await sleep(600);
check((await text()).includes('Ayer ·'), 'stepping back reaches yesterday');
await tap('Mes');
await sleep(600);
await tap('Descargar CSV');
let file = null;
for (let i = 0; i < 30 && !file; i++) {
	await sleep(200);
	file = readdirSync(DOWNLOADS).find((f) => f.endsWith('.csv'));
}
check(!!file && /^bar-beer-\d{4}-\d{2}-01_\d{4}-\d{2}-\d{2}\.csv$/.test(file), `CSV downloaded (${file})`);
if (file) {
	const csv = readFileSync(join(DOWNLOADS, file), 'utf8');
	check(csv.charCodeAt(0) === 0xfeff, 'CSV starts with a BOM for Excel');
	check(csv.slice(1).startsWith('Fecha;Boleta;Hora;Ítem;Tipo;Cantidad;Total;Barbero;Comisión;Estado;Pago;Cliente\r\n'), 'CSV header in Spanish with semicolons');
	check(csv.includes(';Anulada;') && csv.includes('Efectivo 42000'), 'CSV has voided lines and payment methods in Spanish');
	const rows = csv.trim().split('\r\n').length - 1;
	check((await text()).includes(`Descargado: ${rows.toLocaleString('es-CO')}`), `status tells how many lines (${rows})`);
}
await shot('7-reporte-csv', '.csv', 'center');

console.log('Admin: bonus rules');
await as('admin', '/admin/bonos');
t = await text();
check(t.includes('Semana fuerte') && t.includes('$ 50.000 de premio') && t.includes('Mes de oro'), 'rules listed with their reward');
await shot('8-bonos');
await tap('Agregar');
await sleep(800);
await setField(await fieldByLabel('Nombre'), 'Mes de 100');
await tap('Mes');
await setField(await fieldByLabel('Cortes para ganarlo'), '100');
await setField(await fieldByLabel('Monto'), '80000');
await sleep(150);
check((await page.$eval('.preview', (e) => e.textContent)).includes('100 cortes en el mes: $ 80.000 de premio'), 'the form spells the rule out');
check((await page.$$eval('.choice [aria-checked="true"]', (b) => b.map((x) => x.textContent.trim()))).join() === 'Mes,Cortes,Monto fijo', 'value selectors show the choice');
await shot('9-bono-nuevo');
await tap('Crear bono');
await sleep(900);
check((await text()).includes('Creado') && /\/admin\/bonos\/d-r/.test(page.url()), 'rule created, page moves to it');
const ruleUrl = page.url();
await tap('Ventas');
await sleep(100);
check((await text()).includes('Ventas para ganarlo'), 'switching to sales relabels the goal');
await tap('Cortes');
await tap('% de su comisión');
await setField(await fieldByLabel('Porcentaje extra'), '150');
await tap('Guardar');
await sleep(300);
check((await text()).includes('va de 1 a 100'), 'a percentage over 100 is refused');
await as('barber', '/barbero/metas');
check((await text()).includes('Mes de 100'), 'the barber sees the new rule in Metas');
await as('admin', ruleUrl.replace(BASE, ''));
await setField(await fieldByLabel('Activo'), false);
await tap('Guardar');
await sleep(700);
check((await text()).includes('pausado'), 'rule paused');
await as('admin', '/admin/bonos');
check((await text()).includes('Pausado'), 'paused rule stays listed, marked paused');
await tap('Calcular bonos pendientes');
await sleep(700);
check((await text()).includes('no había bonos pendientes'), 'awarding reports the result');
await as('barber', '/barbero/metas');
check(!(await text()).includes('Mes de 100'), 'a paused rule leaves the barber’s goals');

console.log('Admin: paying barbers');
await as('admin', '/admin/pagos');
t = await text();
check(t.includes('Esta semana') && t.includes('Dago') && t.includes('le toca'), 'this week: each barber with what he is owed');
const due = pesos(await page.$eval('.total .big', (e) => e.textContent));
check(due > 0, `the week has something owed (${due})`);
await shot('10-pagos');
await page.click('.rows li a');
await sleep(900);
t = await text();
check(/\/admin\/pagos\/d-/.test(page.url()) && t.includes('Esta semana') && t.includes('Lo que hizo'), 'a row opens that barber on the same week');
check(t.includes('Pagar $'), 'the admin can pay from there');
await tap('Pagos');
await sleep(700);
check(page.url().includes('/admin/pagos?k=week'), 'back keeps the period');

console.log('Admin: voids');
await as('admin', '/admin/anulaciones');
t = await text();
check(t.includes('Cobrado dos veces') && t.includes('Anulada por Luisa'), 'voided bill shows why and who');
await shot('12-anulaciones');

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
