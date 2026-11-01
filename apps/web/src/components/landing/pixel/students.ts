import { ditherIndex, hexToRgb, type Rgb } from './dither'
import { createFbm } from './noise'

// Maya and Omar for the hero, drawn from shapes (signed distances) and dithered into the
// same pixels as the backgrounds. Pure, so the shapes can be tested without a canvas.

const fbm = createFbm(29)

const PALETTES = {
	room: ['#f1f1ec', '#e4e4dc', '#d6d6cc', '#fbfbf8'],
	maya: ['#3a1a0c', '#8a3d16', '#d4671f', '#f19a4f', '#ffd2a8'],
	omar: ['#1d1640', '#4b36a8', '#7c5cff', '#b3a6ff', '#ece8ff'],
	raisedHand: ['#3c4a10', '#9fba18', '#f7fe62', '#fbffd0'],
	desk: ['#0b0b0b', '#2a2a2a', '#444444']
} as const

type Material = keyof typeof PALETTES

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
	let deepest = 1
	SEATS.forEach((seat, i) => {
		const cx = seat.at * aspect
		const lift = raised[i] ?? 0
		const headY = HEAD_Y + Math.sin(t * 1.3 + cx * 7) * 0.006
		const sx = cx + seat.hand * SHOULDER.dx
		const hx = sx + seat.hand * (0.06 + lift * 0.01)
		const hy = HAND_DOWN_Y - (HAND_DOWN_Y - HAND_UP_Y) * lift
		const head = Math.hypot(px - cx, py - headY) - HEAD_RADIUS
		const parts: [number, Material][] = [
			[head, seat.material],
			[capsule(px, py, cx, headY + 0.08, cx, 0.56, 0.06), seat.material],
			[roundedBox(px, py, cx, 0.77, 0.19, 0.22, 0.11), seat.material],
			[capsule(px, py, sx, SHOULDER.y, hx, hy, ARM_RADIUS), seat.material],
			[Math.hypot(px - hx, py - hy) - HAND_RADIUS, lift > 0.5 ? 'raisedHand' : seat.material]
		]
		for (const [distance, part] of parts) {
			if (distance >= 0 || distance >= deepest) continue
			deepest = distance
			material = part
			shade =
				-distance < OUTLINE
					? INK_SHADE
					: 0.3 + 0.55 * Math.min(1, -distance * 14) + 0.12 * fbm(px * 5, py * 5, t * 0.2)
		}
		if (head >= 0) return
		// The face: eyes that blink, Maya's hair with a bun, Omar's glasses.
		const open = (t / BLINK_EVERY + i * 0.37) % 1 < BLINK_SHUT ? 0.15 : 1
		for (const side of [-1, 1]) {
			const ex = cx + side * EYE.dx
			const ey = headY + EYE.dy
			if (Math.hypot(px - ex, (py - ey) / open) < EYE.r) shade = INK_SHADE
			if (seat.name === 'Omar' && Math.abs(Math.hypot(px - ex, py - ey) - LENS.r) < LENS.width)
				shade = INK_SHADE
		}
		if (seat.name === 'Maya' && py < headY - 0.035 + 0.02 * Math.sin((px - cx) * 30))
			shade = HAIR_SHADE
	})
	// Maya's bun sits behind her head, so it only shows where nothing else is drawn.
	const bun = Math.hypot(px - (SEATS[0].at * aspect - 0.09), py - (HEAD_Y - 0.1)) - 0.05
	if (bun < 0 && deepest === 1) {
		material = 'maya'
		shade = -bun < OUTLINE ? INK_SHADE : HAIR_SHADE
	}
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
