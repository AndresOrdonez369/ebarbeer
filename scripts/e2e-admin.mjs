// End-to-end check of the admin screens in demo mode, at phone size, with headless Edge:
// each change is made as admin and then verified where it matters (the register, the mugs).
//   node scripts/e2e-admin.mjs [baseUrl]
// Saves screenshots in .impeccable/review/p5-*.png.
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
	userDataDir: mkdtempSync(join(tmpdir(), 'barbeer-e2e5-')),
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
		const el = lab?.querySelector('input, select');
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
	await page.screenshot({ path: `${OUT}/p5-${name}.png` });
};
const as = async (role, path) => {
	await page.evaluate((r) => sessionStorage.setItem('barbeer-demo-role', r), role);
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
};

await page.goto(BASE + '/ingreso');

console.log('Team: create a barber, give access, special percentage');
await as('admin', '/admin/equipo');
await shot('1-equipo');
await tap('Agregar persona');
await sleep(800);
await setField(await fieldByLabel('Nombre o apodo'), 'Toño');
await tap('Crear persona');
await sleep(900);
let t = await text();
check(t.includes('Persona creada') && /\/admin\/equipo\/d-st/.test(page.url()), 'barber created, page moves to his record');
await setField(await fieldByLabel('Usuario'), 'To ño');
await setField(await fieldByLabel('PIN'), '123456');
await tap('Dar acceso');
await sleep(400);
check((await text()).includes('sin espacios'), 'invalid username refused before calling the server');
await shot('12-usuario-error', '.form-msg.err', 'center');
await setField(await fieldByLabel('Usuario'), 'tono');
await setField(await fieldByLabel('PIN'), '123');
await tap('Dar acceso');
await sleep(500);
check((await text()).includes('al menos 6'), 'short PIN refused');
await setField(await fieldByLabel('Usuario'), 'tono');
await setField(await fieldByLabel('PIN'), '123456');
await tap('Dar acceso');
await sleep(700);
t = await text();
check(t.includes('entra con el usuario «tono»'), 'access granted with user tono');
await shot('2-persona');
const corteId = await page.evaluate(() => {
	const lab = [...document.querySelectorAll('.pcts label')].find((l) => l.textContent.trim().startsWith('Corte') && !l.textContent.includes('+'));
	return lab.getAttribute('for');
});
await setField(`#${corteId}`, '60');
await tap('Guardar porcentajes');
await sleep(700);
check((await text()).includes('Porcentajes guardados'), 'special percentage saved');
await shot('3-porcentajes', '.pcts', 'center');

console.log('The register sees him, and his percentage applies');
await as('cashier', '/caja');
check((await text()).includes('Toño'), 'new barber appears in the lineup');
await tap('Toño');
await tap('Corte 20');
await sleep(100);
await tap('Cobrar $ 20.000');
await sleep(200);
await tap('Exacto');
await tap('Cobrar $ 20.000');
await sleep(900);
await as('admin', '/admin');
const tono = await page.evaluate(() =>
	[...document.querySelectorAll('tbody tr')].map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()).find((r) => r.startsWith('Toño'))
);
check(!!tono && tono.includes('20.000') && tono.includes('12.000'), `commission at 60% (${tono})`);

console.log('Catalog: add, reprice, hide, reorder');
await as('admin', '/admin/catalogo/nuevo');
await tap('Productos');
await setField(await fieldByLabel('Nombre'), 'Gorra');
await setField(await fieldByLabel('Precio'), '40000');
await setField(await fieldByLabel('Comisión'), '0');
await tap('Agregar');
await sleep(800);
check((await text()).includes('Agregado'), 'item added');
await shot('4-item');
await as('admin', '/admin/catalogo');
await shot('5-catalogo');
await page.evaluate(() => [...document.querySelectorAll('ul a')].find((a) => a.textContent.trim().startsWith('Agua')).click());
await sleep(800);
await setField(await fieldByLabel('Visible en la caja'), false);
await tap('Guardar');
await sleep(600);
check((await text()).includes('oculto en la caja'), 'item hidden');
await as('admin', '/admin/catalogo');
await page.evaluate(() => [...document.querySelectorAll('ul a')].find((a) => a.textContent.trim().startsWith('Corte 20') || /^Corte\s+Comisi/.test(a.textContent.trim())).click());
await sleep(800);
await setField(await fieldByLabel('Precio'), '22000');
await tap('Guardar');
await sleep(600);
await as('admin', '/admin/catalogo');
await page.evaluate(() => [...document.querySelectorAll('ul a')].find((a) => a.textContent.trim().startsWith('Cerveza artesanal')).click());
await sleep(800);
await tap('Subir');
await sleep(800);
check(/Ahora es el 1 de/.test(await text()), 'item moved up');
await shot('6-orden', '.moves', 'center');
await as('cashier', '/caja');
t = await text();
check(t.includes('22.000'), 'register shows the new price');
await tap('Productos');
await sleep(100);
check((await text()).includes('Gorra'), 'register shows the new product');
await tap('Bebidas');
await sleep(100);
const drinks = await page.evaluate(() => [...document.querySelectorAll('.grid .item .name')].map((n) => n.textContent.trim()));
check(!drinks.includes('Agua'), 'hidden item is gone from the register');
check(drinks[0] === 'Cerveza artesanal', `reordered item comes first (${drinks.join(', ')})`);

console.log('Customers');
await as('admin', '/admin/clientes');
t = await text();
check(t.includes('Andrés Pérez') && /\d+ visitas?/.test(t), 'customers with visits');
await shot('7-clientes');
await setField('input[type="search"]', 'sara');
await sleep(600);
const found = await page.evaluate(() => [...document.querySelectorAll('ul li .who b')].map((b) => b.textContent));
check(found.length === 1 && found[0] === 'Sara Gómez', 'search by name');
await setField('input[type="search"]', 'zzz');
await sleep(600);
check((await text()).includes('Sin coincidencias'), 'empty search explains itself');
await shot('11-sin-coincidencias');

console.log('Shop settings: daily goal fills the mugs');
await as('admin', '/admin/local');
await setField(await fieldByLabel('Meta diaria'), '10');
await tap('Guardar');
await sleep(600);
check((await text()).includes('Guardado'), 'settings saved');
await shot('8-local');
await as('cashier', '/caja');
check((await text()).includes('/10'), 'mugs use the new goal');

console.log('Guards');
await as('admin', '/admin/equipo/d-jota');
await setField(await fieldByLabel('Activo'), false);
await tap('Guardar datos');
await sleep(600);
await as('cashier', '/caja');
check(!(await text()).includes('Jota'), 'deactivated barber leaves the lineup');
await as('admin', '/admin/equipo/d-admin');
await setField(await fieldByLabel('Activo'), false);
await tap('Guardar datos');
await sleep(600);
check((await text()).includes('al menos un administrador'), 'the last admin cannot be deactivated');
await as('admin', '/admin/equipo/d-admin');
check(
	await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Quitar acceso')?.disabled === true),
	'admin cannot revoke his own access (button disabled)'
);
check((await text()).includes('solo otro administrador puede quitarlo'), 'the reason is shown');
await shot('10-propio-acceso', '.form .btn-danger', 'center');
await setField(await fieldByLabel('Rol'), 'cashier');
await tap('Guardar datos');
await sleep(600);
check((await text()).includes('al menos un administrador'), 'the last admin cannot change his role');

console.log('Revoke needs a confirmation');
await as('admin', '/admin/equipo/d-mono');
await tap('Quitar acceso');
await sleep(200);
let tt = await text();
check(tt.includes('¿Quitar el acceso a Mono?') && tt.includes('Sí, quitar acceso'), 'first tap only asks');
await shot('9-confirmar', '.confirm', 'center');
await tap('Sí, quitar acceso');
await sleep(700);
tt = await text();
check(tt.includes('Acceso quitado') && tt.includes('Dar acceso'), 'second tap revokes; the grant form returns');

console.log('Empty states');
// Empty the demo's customers and products to see the empty states (state lives in sessionStorage).
await page.evaluate(() => {
	const st = JSON.parse(sessionStorage.getItem('barbeer-demo-state'));
	st.customers = [];
	st.items = st.items.filter((i) => i.kind !== 'product');
	sessionStorage.setItem('barbeer-demo-state', JSON.stringify(st));
});
await as('admin', '/admin/clientes');
check((await text()).includes('Todavía sin clientes'), 'no customers yet');
await shot('13-sin-clientes');
await as('admin', '/admin/catalogo');
check((await text()).includes('Sin productos'), 'empty catalog group');
await shot('14-sin-productos', '.empty', 'center');

console.log('Desktop');
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
for (const [path, file] of [
	['/admin/equipo/d-kike', 'desktop-persona.png'],
	['/admin/catalogo', 'desktop-catalogo.png']
]) {
	await page.goto(BASE + path, { waitUntil: 'networkidle0' });
	await sleep(900);
	await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
	await page.screenshot({ path: `${OUT}/${file}` });
}

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
