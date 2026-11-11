// Builds the login artwork and the app icons from the client's logo image.
//   npm run icons
// Source: brand-source/logo-cliente.webp (image sent by the client, 1120 × 1100).
// Replace it with the original vector logo when the client provides it, then rerun.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SRC = 'brand-source/logo-cliente.webp';
const BG = { r: 12, g: 9, b: 6, alpha: 1 }; // --bg #0C0906

// Login artwork: the "E" and the BAR BEER blade on the wood, as the client shows it.
await sharp(SRC)
	.extract({ left: 120, top: 200, width: 880, height: 640 })
	.resize(720)
	.webp({ quality: 62, effort: 6 })
	.toFile('static/brand/logo.webp');

// Icon mark: the bearded "E" alone.
const mark = await sharp(SRC).extract({ left: 330, top: 215, width: 400, height: 440 }).png().toBuffer();

async function icon(size, padding, out) {
	const inner = Math.round(size * (1 - padding * 2));
	const art = await sharp(mark).resize(inner, inner, { fit: 'contain', background: BG }).toBuffer();
	await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
		.composite([{ input: art, gravity: 'center' }])
		.png({ palette: true, quality: 88, compressionLevel: 9 })
		.toFile(out);
}

await icon(192, 0.04, 'static/icons/icon-192.png');
await icon(512, 0.04, 'static/icons/icon-512.png');
// Maskable: Android may crop to a circle, so keep the mark inside the 80 % safe zone.
await icon(512, 0.16, 'static/icons/icon-maskable-512.png');
await icon(180, 0.06, 'static/icons/apple-touch-icon.png');

// Favicon: the tricolor blade, drawn (no raster).
writeFileSync(
	'static/icons/favicon.svg',
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0C0906"/><g transform="skewX(-14) translate(5 0)"><rect x="2" y="10" width="9" height="12" fill="#000" stroke="#E8EAED" stroke-width="1.5"/><rect x="11" y="10" width="7" height="12" fill="#D8121F" stroke="#E8EAED" stroke-width="1.5"/><rect x="18" y="10" width="9" height="12" fill="#2A4FB5" stroke="#E8EAED" stroke-width="1.5"/></g></svg>\n`
);

console.log('Icons and login artwork written.');
