import { ditherIndex, hexToRgb, type Rgb } from './dither'
import { createFbm } from './noise'

// Maya and Omar, drawn from shapes (signed distances) and dithered into the same pixels as
// the backgrounds: the website's hero, and any app scene (scenes.ts). Pure, so the shapes can
// be tested without a canvas.

const fbm = createFbm(29)

const PALETTES = {
	room: ['#f1f1ec', '#e4e4dc', '#d6d6cc', '#fbfbf8'],
	maya: ['#3a1a0c', '#8a3d16', '#d4671f', '#f19a4f', '#ffd2a8'],
	omar: ['#1d1640', '#4b36a8', '#7c5cff', '#b3a6ff', '#ece8ff'],
	raisedHand: ['#3c4a10', '#9fba18', '#f7fe62', '#fbffd0'],
	desk: ['#0b0b0b', '#2a2a2a', '#444444']
} as const

export type Material = keyof typeof PALETTES

const COLOURS = Object.fromEntries(
	Object.entries(PALETTES).map(([name, hexes]) => [name, hexes.map(hexToRgb)])
) as Record<Material, Rgb[]>

/** Where each student sits, as a share of the width, and which side they raise a hand on: towards the middle, away from their speech bubble. */
export const SEATS = [
	{ name: 'Maya', at: 0.3, material: 'maya', hand: 1 },
	{ name: 'Omar', at: 0.7, material: 'omar', hand: -1 }
] as const

/** Below this share of the height is the desk. */
const DESK_TOP = 0.9
const HEAD_Y = 0.37
const HEAD_RADIUS = 0.12
/** Arm and hand positions, in heights, for an arm down and an arm up. */
const SHOULDER = { dx: 0.15, y: 0.62 }
const HAND_DOWN_Y = 0.86
const HAND_UP_Y = 0.22
const ARM_RADIUS = 0.035
const HAND_RADIUS = 0.05
/** How far inside a shape counts as its dark outline, in heights. */
const OUTLINE = 0.012
const EYE = { dx: 0.042, dy: -0.004, r: 0.022 }
/** Omar's glasses: a ring around each eye. */
const LENS = { r: 0.032, width: 0.007 }
/** Seconds between blinks, and the share of that spent with eyes shut. */
const BLINK_EVERY = 4
const BLINK_SHUT = 0.035
/** Shade for outlines, eyes and glasses, and for Maya's hair. */
const INK_SHADE = 0.02
const HAIR_SHADE = 0.14

function capsule(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	r: number
) {
	const vx = bx - ax
	const vy = by - ay
	const h = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
	return Math.hypot(px - ax - vx * h, py - ay - vy * h) - r
}

function roundedBox(
	px: number,
	py: number,
	cx: number,
	cy: number,
	hx: number,
	hy: number,
	r: number
) {
	const qx = Math.abs(px - cx) - hx + r
	const qy = Math.abs(py - cy) - hy + r
	return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** Maya or Omar, placed anywhere: `cx` and `headY` in heights, `scale` 1 is the hero's size. */
export interface Figure {
	name: 'Maya' | 'Omar'
	material: 'maya' | 'omar'
	/** Which side the hand goes up on: 1 right, -1 left. */
	hand: 1 | -1
	cx: number
	headY: number
	scale: number
	/** The hand, 0 down to 1 up. */
	lift: number
	/** Offsets the blink, so two students don't blink together. */
	blinkPhase: number
}

/**
 * One student at a point: the material, shade and how deep inside the figure the point is
 * (negative is inside; the deepest part wins where figures overlap), or null outside it.
 * Every measure is a share of the hero's, times `scale`, so the hero is `scale` 1 with its
 * head at HEAD_Y.
 */
export function figureAt(
	px: number,
	py: number,
	t: number,
	f: Figure
): { material: Material; shade: number; depth: number } | null {
	const s = f.scale
	const { cx, headY, lift } = f
	const sx = cx + f.hand * SHOULDER.dx * s
	const sy = headY + (SHOULDER.y - HEAD_Y) * s
	const hx = sx + f.hand * (0.06 + lift * 0.01) * s
	const hy = headY + (HAND_DOWN_Y - HEAD_Y - (HAND_DOWN_Y - HAND_UP_Y) * lift) * s
	const head = Math.hypot(px - cx, py - headY) - HEAD_RADIUS * s
	const parts: [number, Material][] = [
		[head, f.material],
		[capsule(px, py, cx, headY + 0.08 * s, cx, headY + 0.19 * s, 0.06 * s), f.material],
		[roundedBox(px, py, cx, headY + 0.4 * s, 0.19 * s, 0.22 * s, 0.11 * s), f.material],
		[capsule(px, py, sx, sy, hx, hy, ARM_RADIUS * s), f.material],
		[Math.hypot(px - hx, py - hy) - HAND_RADIUS * s, lift > 0.5 ? 'raisedHand' : f.material]
	]
	let deepest = 0
	let material: Material = f.material
	let shade = 0
	for (const [distance, part] of parts) {
		if (distance >= deepest) continue
		deepest = distance
		material = part
		shade =
			-distance < OUTLINE * s
				? INK_SHADE
				: 0.3 +
					0.55 * Math.min(1, (-distance * 14) / s) +
					0.12 * fbm((px * 5) / s, (py * 5) / s, t * 0.2)
	}
	if (deepest < 0 && head < 0) {
		// The face: eyes that blink, Maya's hair, Omar's glasses.
		const open = (t / BLINK_EVERY + f.blinkPhase) % 1 < BLINK_SHUT ? 0.15 : 1
		for (const side of [-1, 1]) {
			const ex = cx + side * EYE.dx * s
			const ey = headY + EYE.dy * s
			if (Math.hypot(px - ex, (py - ey) / open) < EYE.r * s) shade = INK_SHADE
			if (f.name === 'Omar' && Math.abs(Math.hypot(px - ex, py - ey) - LENS.r * s) < LENS.width * s)
				shade = INK_SHADE
		}
		if (f.name === 'Maya' && py < headY - (0.035 - 0.02 * Math.sin(((px - cx) * 30) / s)) * s)
			shade = HAIR_SHADE
	}
	if (deepest < 0) return { material, shade, depth: deepest }
	// Maya's bun sits behind her head, so any part of anyone drawn there covers it.
	if (f.name === 'Maya') {
		const bun = Math.hypot(px - (cx - 0.09 * s), py - (headY - 0.1 * s)) - 0.05 * s
		if (bun < 0)
			return { material: 'maya', shade: -bun < OUTLINE * s ? INK_SHADE : HAIR_SHADE, depth: -1e-9 }
	}
	return null
}

/** The colours each student's materials are dithered into. */
export const FIGURE_COLOURS: Readonly<Record<Material, readonly Rgb[]>> = COLOURS

/**
 * The material and shade at a point. `px` and `py` are in heights from the top left, so
 * circles stay round. `raised` is each student's hand, 0 down to 1 up.
 */
export function shadeAt(
	px: number,
	py: number,
	aspect: number,
	t: number,
	raised: readonly number[]
): { material: Material; shade: number } {
	let material: Material = 'room'
	let shade = 0.45 + 0.35 * fbm(px * 2, py * 2, t * 0.1)
	if (py > DESK_TOP) {
		material = 'desk'
		shade = 0.2 + 0.3 * fbm(px * 6, py * 6, 0)
	}
	let deepest = 0
	SEATS.forEach((seat, i) => {
		const cx = seat.at * aspect
		const hit = figureAt(px, py, t, {
			name: seat.name,
			material: seat.material,
			hand: seat.hand,
			cx,
			headY: HEAD_Y + Math.sin(t * 1.3 + cx * 7) * 0.006,
			scale: 1,
			lift: raised[i] ?? 0,
			blinkPhase: i * 0.37
		})
		if (hit && hit.depth < deepest) {
			deepest = hit.depth
			material = hit.material
			shade = hit.shade
		}
	})
	return { material, shade }
}

/** Draws the classroom into RGBA `pixels`, `width` by `height`. */
export function renderStudents(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
	t: number,
	raised: readonly number[]
): void {
	const aspect = width / height
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const { material, shade } = shadeAt(x / height, y / height, aspect, t, raised)
			const palette = COLOURS[material]
			const colour = palette[ditherIndex(shade, x, y, palette.length)]!
			const o = (y * width + x) * 4
			pixels[o] = colour[0]
			pixels[o + 1] = colour[1]
			pixels[o + 2] = colour[2]
			pixels[o + 3] = 255
		}
	}
}
