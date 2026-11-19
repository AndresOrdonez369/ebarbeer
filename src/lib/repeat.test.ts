// node --test src/lib/repeat.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billKey, findTwin } from './repeat.ts';

const cut = (barberId: string, qty = 1) => ({ key: 'corte', barberId, qty });
const beer = (qty = 1) => ({ key: 'cerveza', barberId: null, qty });
const at = (min: number) => new Date(Date.UTC(2026, 10, 19, 16, 0) + min * 60_000).toISOString();

test('billKey ignores order and split lines', () => {
	assert.equal(billKey([cut('marlon'), beer(2)]), billKey([beer(1), cut('marlon'), beer(1)]));
	assert.notEqual(billKey([cut('marlon')]), billKey([cut('dago')]));
	assert.notEqual(billKey([cut('marlon')]), billKey([cut('marlon', 2)]));
});

test('the same cut minutes later is a twin; a different barber or 16 minutes later is not', () => {
	const first = { at: at(0), lines: [cut('marlon')], no: 66 };
	assert.equal(findTwin({ at: at(1.5), lines: [cut('marlon')] }, [first])?.no, 66);
	assert.equal(findTwin({ at: at(1.5), lines: [cut('dago')] }, [first]), null);
	assert.equal(findTwin({ at: at(16), lines: [cut('marlon')] }, [first]), null);
});

test('drinks alone are twins only within 2 minutes, and the newest twin wins', () => {
	const a = { at: at(0), lines: [beer()], no: 1 };
	const b = { at: at(1), lines: [beer()], no: 2 };
	assert.equal(findTwin({ at: at(1.5), lines: [beer()] }, [a, b])?.no, 2);
	assert.equal(findTwin({ at: at(3.5), lines: [beer()] }, [a, b]), null);
});

test('a bill is never the twin of one charged after it', () => {
	assert.equal(findTwin({ at: at(0), lines: [cut('marlon')] }, [{ at: at(1), lines: [cut('marlon')] }]), null);
});
