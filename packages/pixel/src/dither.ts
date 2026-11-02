// Ordered dithering: a value per pixel becomes one colour of a small palette, with a 4x4
// Bayer matrix deciding which neighbouring colour each pixel takes. That turns smooth noise
// into the hard, printed-looking pixels the landing page is drawn in.

/** The 4x4 Bayer matrix as thresholds between 0 and 1. */
export const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
	(v) => (v + 0.5) / 16
)

export type Rgb = readonly [number, number, number]

export function hexToRgb(hex: string): Rgb {
	const match = /^#([0-9a-f]{6})$/i.exec(hex)
	if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`)
	const n = parseInt(match[1]!, 16)
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Which palette entry a value in 0..1 takes at pixel (x, y). Values outside 0..1 are
 * clamped, so a field can overshoot for a harder edge.
 */
export function ditherIndex(value: number, x: number, y: number, paletteSize: number): number {
	const last = paletteSize - 1
	const scaled = Math.max(0, Math.min(0.999, value)) * last
	const base = Math.floor(scaled)
	return scaled - base > BAYER_4[(y & 3) * 4 + (x & 3)]! ? base + 1 : base
}

/** A field gives each pixel a value in 0..1. `aspect` is width over height. */
export type Field = (x: number, y: number, t: number, aspect: number) => number

/** Draws one frame of `field` into RGBA `pixels`, `width` by `height`. */
export function renderField(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
	field: Field,
	palette: readonly Rgb[],
	t: number
): void {
	const aspect = width / height
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const colour =
				palette[ditherIndex(field(x / width, y / height, t, aspect), x, y, palette.length)]!
			const o = (y * width + x) * 4
			pixels[o] = colour[0]
			pixels[o + 1] = colour[1]
			pixels[o + 2] = colour[2]
			pixels[o + 3] = 255
		}
	}
}
