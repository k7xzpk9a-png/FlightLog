// Generates the PWA icons as PNGs with zero dependencies (pure Node + zlib).
// Run: node tools/gen_icons.mjs
// Placeholder art: dark navy background with a light upward "paper plane"
// triangle. Replace with real artwork later — the manifest paths stay the same.
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../app/assets/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
	let c = ~0;
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i];
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}
function chunk(type, data) {
	const t = Buffer.from(type, 'ascii');
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([t, data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}
function png(size, draw) {
	const px = Buffer.alloc(size * size * 4);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			const [r, g, b, a] = draw(x, y, size);
			const i = (y * size + x) * 4;
			px[i] = r;
			px[i + 1] = g;
			px[i + 2] = b;
			px[i + 3] = a;
		}
	const stride = size * 4 + 1;
	const raw = Buffer.alloc(size * stride);
	for (let y = 0; y < size; y++) {
		raw[y * stride] = 0; // filter: none
		px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
	}
	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA
	const idat = zlib.deflateSync(raw, { level: 9 });
	return Buffer.concat([
		sig,
		chunk('IHDR', ihdr),
		chunk('IDAT', idat),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const bg = [15, 23, 42, 255]; // slate-900 #0f172a
const fg = [125, 211, 252, 255]; // sky-300 #7dd3fc

function plane(maskable) {
	return (x, y, s) => {
		const cx = s / 2,
			cy = s / 2;
		const scale = maskable ? 0.6 : 0.74; // shrink for maskable safe zone
		const half = (s * scale) / 2;
		const nx = (x - cx) / half;
		const ny = (y - cy) / half;
		const inTri =
			ny <= 0.8 &&
			ny >= -1 &&
			(ny + 1) * 0.8 >= Math.abs(nx) &&
			!(ny > 0.2 && Math.abs(nx) < (0.8 - ny) * 0.5); // bottom V-notch
		return inTri ? fg : bg;
	};
}

writeFileSync(new URL('icon-192.png', OUT), png(192, plane(false)));
writeFileSync(new URL('icon-512.png', OUT), png(512, plane(false)));
writeFileSync(new URL('icon-512-maskable.png', OUT), png(512, plane(true)));
writeFileSync(new URL('apple-touch-icon.png', OUT), png(180, plane(false)));
console.log('icons written to app/assets/icons/');
