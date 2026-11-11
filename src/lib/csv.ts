// CSV for spreadsheets set to Spanish: semicolon separated (the comma is the decimal mark there),
// CRLF line ends and a UTF-8 byte order mark so Excel reads the accents.

type Cell = string | number | null | undefined;

function cell(v: Cell): string {
	if (v == null) return '';
	const s = String(v);
	return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
	return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Hands the browser a file to save. */
export function downloadCsv(filename: string, text: string) {
	const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
