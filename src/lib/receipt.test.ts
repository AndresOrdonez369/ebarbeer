// node --test src/lib/receipt.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReceiptMessage, normalizePhone, prettyPhone, whatsappLink, type ReceiptData } from './receipt.ts';

const data: ReceiptData = {
	shop: 'Bar Beer',
	receiptNo: 147,
	createdAt: '2026-11-10T23:42:00Z',
	lines: [
		{ name: 'Corte + barba', qty: 1, total: 30000, barber: 'Kike' },
		{ name: 'Cerveza', qty: 2, total: 12000, barber: null }
	],
	total: 42000,
	payments: [{ method: 'cash', amount: 42000 }],
	customerName: 'Andrés Pérez',
	link: 'https://barbeer.app/b/abc'
};

test('default template carries every fact of the bill', () => {
	const m = buildReceiptMessage(null, data);
	assert.match(m, /^\*Bar Beer\* · Boleta N\.º 0147/);
	assert.match(m, /Corte \+ barba \(Kike\) — \$30\.000/);
	assert.match(m, /Cerveza × 2 — \$12\.000/);
	assert.match(m, /\*Total: \$42\.000\* · Efectivo/);
	assert.match(m, /Gracias, Andrés\. Te atendió Kike\./);
	assert.match(m, /Tu boleta: https:\/\/barbeer\.app\/b\/abc$/);
});

test('no customer name gives a plain thank-you', () => {
	assert.match(buildReceiptMessage(null, { ...data, customerName: null }), /¡Gracias! Te atendió Kike\./);
});

test('custom template keeps unknown placeholders visible', () => {
	assert.equal(buildReceiptMessage('{local} {numero} {oops}', data), 'Bar Beer 0147 {oops}');
});

test('blank template falls back to the default', () => {
	assert.match(buildReceiptMessage('   ', data), /Boleta N\.º 0147/);
});

test('mixed payment lists both methods', () => {
	const m = buildReceiptMessage('{pago}', {
		...data,
		payments: [
			{ method: 'cash', amount: 20000 },
			{ method: 'transfer', amount: 22000 }
		]
	});
	assert.equal(m, 'Efectivo + Transferencia');
});

test('phones normalise like the database', () => {
	assert.equal(normalizePhone('300 555 0147'), '573005550147');
	assert.equal(normalizePhone('+57 300-555-0147'), '573005550147');
	assert.equal(normalizePhone('12'), null);
	assert.equal(prettyPhone('+573005550147'), '300 555 0147');
});

test('WhatsApp link opens the chat with the message encoded', () => {
	const url = whatsappLink('+573005550147', 'Hola *Bar Beer*\nN.º 1');
	assert.equal(url, 'https://wa.me/573005550147?text=Hola%20*Bar%20Beer*%0AN.%C2%BA%201');
});
