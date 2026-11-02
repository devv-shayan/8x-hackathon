// Renders the app's icon, Android adaptive icon, splash mark and web favicon from the pixel
// engine: the black band's lime tunnel behind the website's mark, a 3x3 block of pixels with
// one lime cell for a student's raised hand. Run it after changing the art, then make a store
// build: icons and the splash are baked into the native app.
//
//   npm run build:icons --workspace=@app/pixel
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { ditherIndex, hexToRgb, PIXEL_FIELDS } from '../index.ts'

const ASSETS = new URL('../../../apps/mobile/assets/', import.meta.url)

/** The mark's cells, as the website's BrandMark draws them. */
const CELLS = ['ink', 'ink', 'ink', 'ink', 'off', 'off', 'ink', 'ink', 'lime']
const PAPER = hexToRgb('#f4f4f0')
const INK = hexToRgb('#0b0b0b')
const LIME = hexToRgb('#f7fe62')
/** The tunnel's centre is off to the right on the website; this moves it to the middle. */
const CENTRE_SHIFT = { x: 0.22, y: 0.05 }
/** How many dithered cells across the icon. */
const GRID = 64
/** The moment of the tunnel to freeze. */
const FRAME_T = 2.4

/**
 * Where the mark's cells are, as a share of the image: `size` is the mark's width, and the
 * gaps between cells are a sixth of a cell.
 */
function markAt(fx, fy, size) {
	const cell = size / (3 + 2 / 6)
	const gap = cell / 6
	const start = (1 - size) / 2
	for (let i = 0; i < 9; i++) {
		const x = start + (i % 3) * (cell + gap)
		const y = start + Math.floor(i / 3) * (cell + gap)
		if (fx >= x && fx < x + cell && fy >= y && fy < y + cell) return { kind: CELLS[i], x, y, cell }
	}
	return null
}

/** The tunnel with the mark on it, `px` square, the mark `markSize` of the width. */
function icon(px, markSize) {
	const png = new PNG({ width: px, height: px })
	const { field, palette } = PIXEL_FIELDS.tunnel
	const colours = palette.map(hexToRgb)
	const cellPx = px / GRID
	// The tunnel, once per dithered cell.
	const cells = Array.from({ length: GRID * GRID }, (_, i) =>
		field(
			(i % GRID) / GRID + CENTRE_SHIFT.x,
			Math.floor(i / GRID) / GRID + CENTRE_SHIFT.y,
			FRAME_T,
			1
		)
	)
	for (let y = 0; y < px; y++) {
		for (let x = 0; x < px; x++) {
			const fx = x / px
			const fy = y / px
			const hit = markAt(fx, fy, markSize)
			let colour
			if (hit && hit.kind === 'ink') colour = PAPER
			else if (hit && hit.kind === 'lime') colour = LIME
			else {
				const gx = Math.floor(x / cellPx)
				const gy = Math.floor(y / cellPx)
				// Quieter right around the mark, so it reads at 29pt on a busy home screen.
				const near = Math.max(Math.abs(fx - 0.5), Math.abs(fy - 0.5)) < markSize / 2 + 0.05
				const value = cells[gy * GRID + gx]
				colour = colours[ditherIndex(near ? value * 0.35 : value, gx, gy, colours.length)]
			}
			const o = (y * px + x) * 4
			png.data[o] = colour[0]
			png.data[o + 1] = colour[1]
			png.data[o + 2] = colour[2]
			png.data[o + 3] = 255
		}
	}
	return png
}

/** The mark alone on transparent, for the white splash: black cells, the lime one outlined. */
function splashMark(px, markSize) {
	const png = new PNG({ width: px, height: px })
	for (let y = 0; y < px; y++) {
		for (let x = 0; x < px; x++) {
			const hit = markAt(x / px, y / px, markSize)
			const o = (y * px + x) * 4
			if (!hit || hit.kind === 'off') continue
			let colour = INK
			if (hit.kind === 'lime') {
				const edge = (hit.cell / 10) * px
				const lx = x - hit.x * px
				const ly = y - hit.y * px
				const inside =
					lx > edge && ly > edge && lx < hit.cell * px - edge && ly < hit.cell * px - edge
				colour = inside ? LIME : INK
			}
			png.data[o] = colour[0]
			png.data[o + 1] = colour[1]
			png.data[o + 2] = colour[2]
			png.data[o + 3] = 255
		}
	}
	return png
}

export const ICONS = {
	// iOS masks the corners itself; the mark sits well inside them.
	'icon.png': () => icon(1024, 0.5),
	// Android crops the foreground to a circle or squircle in its middle two thirds.
	'adaptive-icon.png': () => icon(1024, 0.36),
	'splash-icon.png': () => splashMark(1024, 0.6),
	'favicon.png': () => icon(48, 0.62)
}

/** The PNG file for one of ICONS, byte for byte. */
export function iconFile(name) {
	return PNG.sync.write(ICONS[name]())
}

export const ICON_DIR = ASSETS

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	for (const name of Object.keys(ICONS)) {
		writeFileSync(new URL(name, ASSETS), iconFile(name))
		console.log(`Wrote apps/mobile/assets/${name}`)
	}
}
