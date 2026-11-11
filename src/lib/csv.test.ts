import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toCsv } from './csv.ts';

test('csv starts with a BOM and uses semicolons and CRLF', () => {
	const t = toCsv(['Ítem', 'Total'], [['Corte', 20000]]);
	assert.equal(t, '﻿Ítem;Total\r\nCorte;20000\r\n');
});

test('csv quotes cells with separators, quotes or line breaks', () => {
	const t = toCsv(['a'], [['Corte; barba'], ['Dijo "hola"'], ['dos\nlíneas'], [null]]);
	assert.equal(t, '﻿a\r\n"Corte; barba"\r\n"Dijo ""hola"""\r\n"dos\nlíneas"\r\n\r\n');
});
