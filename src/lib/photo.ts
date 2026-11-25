// Photos are shrunk on the phone before they go anywhere: a 12-megapixel shot (3–5 MB) becomes
// ~100 kB at 1024 px on its long side, plus a ~15 kB thumbnail for the lists. That keeps uploads
// quick on the shop's Wi-Fi and the free plan's 1 GB lasting.
import type { PhotoAngle, ShotFile } from './types.js';

export const ANGLES: { angle: PhotoAngle; label: string }[] = [
	{ angle: 'front', label: 'Frente' },
	{ angle: 'left', label: 'Izquierda' },
	{ angle: 'right', label: 'Derecha' },
	{ angle: 'back', label: 'Atrás' }
];
export const angleLabel = (a: PhotoAngle) => ANGLES.find((x) => x.angle === a)?.label ?? a;

const FULL = { side: 1024, quality: 0.72, max: 180_000 };
const THUMB = { side: 320, quality: 0.6, max: 40_000 };

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
	try {
		// Respects the EXIF rotation of phone cameras.
		return await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		const url = URL.createObjectURL(file);
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
			return img;
		} finally {
			URL.revokeObjectURL(url);
		}
	}
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
	return new Promise((res) => canvas.toBlob(res, type, quality));
}

async function draw(
	src: ImageBitmap | HTMLImageElement,
	spec: { side: number; quality: number; max: number },
	type: string
): Promise<Blob> {
	const w0 = src.width;
	const h0 = src.height;
	const k = Math.min(1, spec.side / Math.max(w0, h0));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(w0 * k));
	canvas.height = Math.max(1, Math.round(h0 * k));
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
	// Lower the quality a little until it fits; a busy photo can come out larger than usual.
	let q = spec.quality;
	let blob = await encode(canvas, type, q);
	while (blob && blob.size > spec.max && q > 0.4) {
		q -= 0.1;
		blob = await encode(canvas, type, q);
	}
	if (!blob) throw new Error('encode');
	return blob;
}

/** Whether this browser writes WebP (Safari writes PNG when asked for WebP). */
let webp: boolean | null = null;
async function canWebp(): Promise<boolean> {
	if (webp != null) return webp;
	const c = document.createElement('canvas');
	c.width = c.height = 2;
	const b = await encode(c, 'image/webp', 0.8);
	return (webp = b?.type === 'image/webp');
}

/** Shrinks a photo from the camera into what is uploaded. Throws when the file is not an image. */
export async function shrink(file: Blob, angle: PhotoAngle): Promise<ShotFile> {
	const src = await decode(file);
	const ext = (await canWebp()) ? 'webp' : 'jpg';
	const type = ext === 'webp' ? 'image/webp' : 'image/jpeg';
	try {
		const [full, thumb] = [await draw(src, FULL, type), await draw(src, THUMB, type)];
		return { angle, full, thumb, ext };
	} finally {
		if ('close' in src) src.close();
	}
}
