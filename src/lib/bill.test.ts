// node --test src/lib/bill.test.ts  (Node 24 runs TypeScript directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeDue, parsePesos, paymentProblem, quickCash } from './bill.ts';

test('parsePesos reads what a cashier types', () => {
	assert.equal(parsePesos('50.000'), 50000);
	assert.equal(parsePesos('$ 67 000'), 67000);
	assert.equal(parsePesos(''), 0);
	assert.equal(parsePesos('abc'), 0);
});

test('change is never negative', () => {
	assert.equal(changeDue(42000, 50000), 8000);
	assert.equal(changeDue(42000, 42000), 0);
	assert.equal(changeDue(42000, 10000), 0);
});

test('quick cash offers exact plus round bills above', () => {
	assert.deepEqual(quickCash(42000), [42000, 50000, 60000, 100000]);
	assert.deepEqual(quickCash(50000), [50000, 60000, 100000]);
	assert.deepEqual(quickCash(0), []);
});

test('a single exact payment is fine', () => {
	assert.equal(paymentProblem(42000, [{ method: 'cash', amount: 42000, cashReceived: 50000 }]), null);
});

test('mixed payment must add up exactly', () => {
	assert.equal(
		paymentProblem(67000, [
			{ method: 'cash', amount: 40000 },
			{ method: 'transfer', amount: 27000 }
		]),
		null
	);
	assert.match(paymentProblem(67000, [{ method: 'cash', amount: 40000 }])!, /Faltan \$ 27\.000/);
	assert.match(paymentProblem(67000, [{ method: 'card', amount: 70000 }])!, /Sobran \$ 3\.000/);
});

test('cash received below the cash part is refused', () => {
	assert.match(paymentProblem(42000, [{ method: 'cash', amount: 42000, cashReceived: 40000 }])!, /no alcanza/);
});

test('nothing to pay is refused', () => {
	assert.equal(paymentProblem(42000, []), 'Escribe cuánto se paga.');
});
