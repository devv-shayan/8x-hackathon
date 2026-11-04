import { ditherIndex, type Rgb } from './dither'
import { createFbm } from './noise'

// A video's thumbnail coming in on the class's board while the video reads (8X-49), in the
// app's own pattern: a five-step ramp of one colour, dithered into cells like every background.
// The ramp is built from the thumbnail's dominant colour. As the read goes on, contrast brings
// the picture's shapes out of that colour, the cells get finer, and its other colours come in.
// Pure, so it's tested without a canvas; board.ts draws it.

const fbm = createFbm(11)

/** An image's pixels, RGBA, `width` by `height`. */
export interface Picture {
	data: ArrayLike<number>
	width: number
	height: number
}

export interface RevealColours {
	/** The colour most of the picture is. */
	dominant: Rgb
	/** Near-black to near-white through the dominant colour: the ramp every cell dithers into. */
	ramp: Rgb[]
}

const BLACK: Rgb = [11, 11, 11]
const WHITE: Rgb = [255, 255, 250]
/** How much of each end of the ramp is the dominant colour, from the darkest step up. */
const RAMP_MIX = [0.86, 0.55, 0, 0.5, 0.86]
/** k-means on the thumbnail: how many colours, how many rounds, and one pixel in how many. */
const CLUSTERS = 6
const ROUNDS = 12
const SAMPLE_STEP = 3

function mix(a: Rgb, b: Rgb, k: number): Rgb {
	return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

function distance(a: Rgb, b: Rgb) {
	return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

export function luminance([r, g, b]: Rgb): number {
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** The picture's dominant colour (the biggest k-means cluster) and the ramp built from it. */
export function revealColours(picture: Picture): RevealColours {
	const samples: Rgb[] = []
	for (let y = 0; y < picture.height; y += SAMPLE_STEP)
		for (let x = 0; x < picture.width; x += SAMPLE_STEP) {
			const o = (y * picture.width + x) * 4
			samples.push([picture.data[o]!, picture.data[o + 1]!, picture.data[o + 2]!])
		}
	if (samples.length === 0) return { dominant: WHITE, ramp: RAMP_MIX.map(() => WHITE) }
	let centres = Array.from(
		{ length: CLUSTERS },
		(_, i) => samples[Math.floor(((i + 0.5) / CLUSTERS) * samples.length)]!
	)
	let counts = centres.map(() => 0)
	for (let round = 0; round < ROUNDS; round++) {
		const sums = centres.map(() => [0, 0, 0, 0])
		for (const sample of samples) {
			let best = 0
			for (let i = 1; i < centres.length; i++)
				if (distance(sample, centres[i]!) < distance(sample, centres[best]!)) best = i
			const sum = sums[best]!
			sum[0]! += sample[0]
			sum[1]! += sample[1]
			sum[2]! += sample[2]
			sum[3]! += 1
		}
		centres = sums.map(([r, g, b, n], i): Rgb => (n ? [r! / n, g! / n, b! / n] : centres[i]!))
		counts = sums.map((sum) => sum[3]!)
	}
	const dominant = centres[counts.indexOf(Math.max(...counts))]!
	const ramp = RAMP_MIX.map((k, i) => (i < 2 ? mix(dominant, BLACK, k) : mix(dominant, WHITE, k)))
	return { dominant, ramp }
}

/** How a read's progress looks on the board: how many cells across, contrast and own colours. */
export interface RevealStage {
	/** Cells across the board; the cells are square. */
	columns: number
	/** 0 is a field of the dominant colour, 1 the picture's full light and dark. */
	contrast: number
	/** 0 keeps every cell in the ramp, 1 lets bright other colours show as they are. */
	hues: number
}

/** The stages, from opening to nearly done: at or above `from` progress, this is the board. */
const STAGES: readonly (RevealStage & { from: number })[] = [
	{ from: 0, columns: 32, contrast: 0, hues: 0 },
	{ from: 0.1, columns: 32, contrast: 0.35, hues: 0 },
	{ from: 0.3, columns: 40, contrast: 0.7, hues: 0 },
	{ from: 0.5, columns: 40, contrast: 1, hues: 0 },
	{ from: 0.7, columns: 64, contrast: 1, hues: 0 },
	{ from: 0.85, columns: 80, contrast: 1, hues: 1 }
]

/** The board's look for a progress from 0 to 1. Ready is drawn as the real picture instead. */
export function revealStage(progress: number): RevealStage {
	let stage = STAGES[0]!
	for (const s of STAGES) if (progress >= s.from) stage = s
	return { columns: stage.columns, contrast: stage.contrast, hues: stage.hues }
}

/** A cell's own colour counts as one of the picture's others when it's this saturated and far. */
const OWN_SATURATION = 90
const OWN_DISTANCE = 120

/**
 * Draws one frame of the board into RGBA `pixels`, `columns` by `rows` cells: each cell the
 * average of the picture under it, its brightness against the dominant colour's dithered into
 * the ramp. `t` moves the slow field the opening shows.
 */
export function renderReveal(
	pixels: Uint8ClampedArray,
	columns: number,
	rows: number,
	picture: Picture,
	colours: RevealColours,
	stage: RevealStage,
	t: number
): void {
	const cellW = picture.width / columns
	const cellH = picture.height / rows
	const cells: { colour: Rgb; light: number }[] = []
	for (let cy = 0; cy < rows; cy++)
		for (let cx = 0; cx < columns; cx++) {
			const x0 = Math.floor(cx * cellW)
			const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW))
			const y0 = Math.floor(cy * cellH)
			const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH))
			let r = 0
			let g = 0
			let b = 0
			let n = 0
			for (let y = y0; y < Math.min(picture.height, y1); y++)
				for (let x = x0; x < Math.min(picture.width, x1); x++) {
					const o = (y * picture.width + x) * 4
					r += picture.data[o]!
					g += picture.data[o + 1]!
					b += picture.data[o + 2]!
					n++
				}
			const colour: Rgb = n ? [r / n, g / n, b / n] : colours.dominant
			cells.push({ colour, light: luminance(colour) })
		}
	const lights = cells.map((cell) => cell.light)
	const spread = Math.max(...lights) - Math.min(...lights) || 1
	const middle = luminance(colours.dominant)
	cells.forEach(({ colour, light }, i) => {
		const cx = i % columns
		const cy = Math.floor(i / columns)
		// The dominant colour sits on the ramp's middle step, so it stays solid.
		const value =
			0.5 +
			((light - middle) / spread) * stage.contrast * 1.3 +
			(1 - stage.contrast * 0.8) * 0.2 * fbm(cx * 0.16, cy * 0.16, t * 0.2)
		let out = colours.ramp[ditherIndex(value, cx, cy, colours.ramp.length)]!
		if (stage.hues > 0) {
			const saturation = Math.max(...colour) - Math.min(...colour)
			if (
				saturation > OWN_SATURATION &&
				Math.sqrt(distance(colour, colours.dominant)) > OWN_DISTANCE
			)
				out = mix(out, colour, stage.hues)
		}
		const o = i * 4
		pixels[o] = out[0]
		pixels[o + 1] = out[1]
		pixels[o + 2] = out[2]
		pixels[o + 3] = 255
	})
}
