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
	desk: ['#0b0b0b', '#2a2a2a', '#444444'],
	/** The class's school desks: dark grain up to the lit edge of the top. */
	wood: ['#24140a', '#4e2c0f', '#7a4818', '#a8702a', '#d9a75a']
} as const

/**
 * A classroom chalkboard. Illustration colours, not UI tokens.
 * The pixel fields' greens are lime and olive, which is a different green.
 */
export const CLASSROOM_BOARD = {
	wood: PALETTES.wood,
	green: '#146B48',
	chalk: '#F4F0E4',
	/** A chalk swipe behind a word. Not the brand's lime highlight. */
	mark: '#E6D48A'
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
export const HEAD_RADIUS = 0.12
/**
 * How far the top of the body sits above where it once did, in heights: a short neck, so they
 * read as people. Only the top moves: the head, hands and feet stay put, so every scene's
 * layout holds.
 */
const NECK_CUT = 0.045
/** Arm and hand positions, in heights, for an arm down and an arm up. */
const SHOULDER = { dx: 0.15, y: 0.62 - NECK_CUT }
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

/** How a student is posed: standing (every scene), or sitting at a desk facing us (the class). */
export type Pose = 'standing' | 'seated'

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
	/** Standing unless set. A seated student's feet are `SEATED_FEET` heights below the head. */
	pose?: Pose
	/** Their mouth moves, while their voice plays. */
	talking?: boolean
	/** How far into shadow they are, 0 to 1: darker shades, except a raised hand. */
	dim?: number
}

/** A part of a figure: its distance, material, extra light, and whether it rests on the desk. */
type Part = [distance: number, material: Material, light?: number, front?: boolean]

/** Where a seated student's parts go, in heights from the head's centre, times the scale. */
const SEATED = {
	torso: { y: 0.34 - NECK_CUT / 2, hx: 0.19, hy: 0.16 + NECK_CUT / 2, r: 0.11 },
	lap: { y: 0.52, hx: 0.18, hy: 0.06, r: 0.06 },
	knee: { dx: 0.09, y: 0.555, r: 0.065 },
	shin: { dx: 0.085, top: 0.56, bottom: 0.79, r: 0.045 },
	shoe: { in: 0.07, out: 0.13, y: 0.82, r: 0.035 },
	/** The arm that isn't raised lies along the desk: elbow out, hand towards the middle. */
	elbow: { dx: 0.2, y: 0.4 },
	restingHand: { dx: 0.04, y: 0.425, r: 0.045 },
	shoulderY: 0.25 - NECK_CUT,
	handUp: { dx: 0.2, y: -0.15 }
} as const
/** How far below a seated student's head their shoes are, in heights times the scale. */
export const SEATED_FEET = SEATED.shoe.y + SEATED.shoe.r
/** Where a seated student's desk top is, and how far it reaches either side of them. */
export const DESK = { top: 0.405, half: 0.27 } as const
/** A talking mouth, and how fast it opens and closes, in radians a second. */
const MOUTH = { y: 0.06, hx: 0.03, hy: 0.014, speed: 11 }

function standingParts(px: number, py: number, f: Figure): Part[] {
	const s = f.scale
	const { cx, headY, lift } = f
	const sx = cx + f.hand * SHOULDER.dx * s
	const sy = headY + (SHOULDER.y - HEAD_Y) * s
	const hx = sx + f.hand * (0.06 + lift * 0.01) * s
	const hy = headY + (HAND_DOWN_Y - HEAD_Y - (HAND_DOWN_Y - HAND_UP_Y) * lift) * s
	return [
		[capsule(px, py, cx, headY + 0.08 * s, cx, headY + 0.19 * s, 0.06 * s), f.material],
		[
			roundedBox(
				px,
				py,
				cx,
				headY + (0.4 - NECK_CUT / 2) * s,
				0.19 * s,
				(0.22 + NECK_CUT / 2) * s,
				0.11 * s
			),
			f.material
		],
		[capsule(px, py, sx, sy, hx, hy, ARM_RADIUS * s), f.material],
		[Math.hypot(px - hx, py - hy) - HAND_RADIUS * s, lift > 0.5 ? 'raisedHand' : f.material]
	]
}

/**
 * Sitting at a desk, facing us: a shorter torso, the lap and knees, shins and shoes under the
 * desk, one forearm along the desk top and the other hand going up (`lift`), or resting on
 * the desk beside the first.
 */
function seatedParts(px: number, py: number, f: Figure): Part[] {
	const s = f.scale
	const { cx, headY, lift } = f
	const h = f.hand
	const shoulderY = headY + SEATED.shoulderY * s
	const up = {
		x: cx + h * SEATED.handUp.dx * s,
		y: headY + SEATED.handUp.y * s
	}
	const down = { x: cx + h * SEATED.restingHand.dx * s, y: headY + SEATED.restingHand.y * s }
	const hand = { x: down.x + (up.x - down.x) * lift, y: down.y + (up.y - down.y) * lift }
	const elbow = { x: cx - h * SEATED.elbow.dx * s, y: headY + SEATED.elbow.y * s }
	const rest = { x: cx - h * SEATED.restingHand.dx * s, y: headY + SEATED.restingHand.y * s }
	const { torso, lap, knee, shin, shoe } = SEATED
	return [
		[capsule(px, py, cx, headY + 0.08 * s, cx, headY + 0.19 * s, 0.06 * s), f.material],
		[
			roundedBox(px, py, cx, headY + torso.y * s, torso.hx * s, torso.hy * s, torso.r * s),
			f.material
		],
		[
			roundedBox(px, py, cx, headY + lap.y * s, lap.hx * s, lap.hy * s, lap.r * s),
			f.material,
			0.08
		],
		// Knees are nearer to us than the lap, so they catch the light.
		...[-1, 1].map((side): Part => [
			Math.hypot(px - (cx + side * knee.dx * s), py - (headY + knee.y * s)) - knee.r * s,
			f.material,
			0.14
		]),
		...[-1, 1].map((side): Part => [
			capsule(
				px,
				py,
				cx + side * shin.dx * s,
				headY + shin.top * s,
				cx + side * (shin.dx + 0.01) * s,
				headY + shin.bottom * s,
				shin.r * s
			),
			f.material
		]),
		...[-1, 1].map((side): Part => [
			capsule(
				px,
				py,
				cx + side * shoe.in * s,
				headY + shoe.y * s,
				cx + side * shoe.out * s,
				headY + shoe.y * s,
				shoe.r * s
			),
			'desk'
		]),
		[
			capsule(px, py, cx + h * SHOULDER.dx * s, shoulderY, hand.x, hand.y, ARM_RADIUS * s),
			f.material
		],
		[
			Math.hypot(px - hand.x, py - hand.y) - HAND_RADIUS * s,
			lift > 0.5 ? 'raisedHand' : f.material,
			0,
			lift <= 0.5
		],
		[
			capsule(px, py, cx - h * SHOULDER.dx * s, shoulderY, elbow.x, elbow.y, ARM_RADIUS * s),
			f.material
		],
		[capsule(px, py, elbow.x, elbow.y, rest.x, rest.y, ARM_RADIUS * s), f.material, 0, true],
		[Math.hypot(px - rest.x, py - rest.y) - SEATED.restingHand.r * s, f.material, 0, true]
	]
}

/**
 * One student at a point: the material, shade and how deep inside the figure the point is
 * (negative is inside; the deepest part wins where figures overlap), or null outside it.
 * `front` is set on the parts of a seated student that rest on the desk, so the desk is
 * drawn between them and the rest of the body. Every measure is a share of the hero's,
 * times `scale`, so the hero is `scale` 1 with its head at HEAD_Y.
 */
export function figureAt(
	px: number,
	py: number,
	t: number,
	f: Figure
): { material: Material; shade: number; depth: number; front?: boolean } | null {
	const s = f.scale
	const { cx, headY } = f
	const head = Math.hypot(px - cx, py - headY) - HEAD_RADIUS * s
	const parts: Part[] = [
		[head, f.material],
		...(f.pose === 'seated' ? seatedParts(px, py, f) : standingParts(px, py, f))
	]
	let deepest = 0
	let material: Material = f.material
	let shade = 0
	let front = false
	for (const [distance, part, light = 0, onDesk = false] of parts) {
		if (distance >= deepest) continue
		deepest = distance
		material = part
		front = onDesk
		shade =
			-distance < OUTLINE * s
				? INK_SHADE
				: 0.3 +
					light +
					0.55 * Math.min(1, (-distance * 14) / s) +
					0.12 * fbm((px * 5) / s, (py * 5) / s, t * 0.2)
	}
	if (deepest < 0 && head < 0) {
		// The face: eyes that blink, Maya's hair, Omar's glasses, a mouth while talking.
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
		if (f.talking) {
			const wide = 0.45 + 0.55 * Math.abs(Math.sin(t * MOUTH.speed))
			if (
				Math.abs(px - cx) < MOUTH.hx * s &&
				Math.abs(py - (headY + MOUTH.y * s)) < MOUTH.hy * s * wide
			)
				shade = INK_SHADE
		}
	}
	if (deepest < 0 && f.dim && material !== 'raisedHand') shade *= 1 - f.dim
	if (deepest < 0)
		return front ? { material, shade, depth: deepest, front } : { material, shade, depth: deepest }
	// Maya's bun sits behind her head, so any part of anyone drawn there covers it.
	if (f.name === 'Maya') {
		const bun = Math.hypot(px - (cx - 0.09 * s), py - (headY - 0.1 * s)) - 0.05 * s
		if (bun < 0)
			return { material: 'maya', shade: -bun < OUTLINE * s ? INK_SHADE : HAIR_SHADE, depth: -1e-9 }
	}
	return null
}

/** The desk in front of a student seated at `cx` with their head at `headY`. */
const DESK_PARTS = {
	/** The top's lit face, then the darker apron under it. */
	topHeight: 0.03,
	apron: { y: 0.075, hy: 0.04, inset: 0.01 },
	leg: { inset: 0.03, top: 0.1, r: 0.022 }
} as const

/**
 * A seated student's school desk at a point, in their scale: the top's lit face, the apron
 * under it and two legs down to their shoes, with the same outline and grain as the students.
 * `dim` shades it with them. Null outside it.
 */
export function deskAt(
	px: number,
	py: number,
	t: number,
	f: Pick<Figure, 'cx' | 'headY' | 'scale' | 'dim'>
): { material: Material; shade: number; depth: number } | null {
	const s = f.scale
	const top = f.headY + DESK.top * s
	const half = DESK.half * s
	const floor = f.headY + SEATED_FEET * s
	const { apron, leg } = DESK_PARTS
	const parts: [number, number][] = [
		[roundedBox(px, py, f.cx, top + 0.012 * s, half, DESK_PARTS.topHeight * s, 0.012 * s), 0.35],
		[
			roundedBox(px, py, f.cx, top + apron.y * s, half - apron.inset * s, apron.hy * s, 0.01 * s),
			-0.05
		],
		...[-1, 1].map((side): [number, number] => {
			const x = f.cx + side * (half - leg.inset * s)
			return [capsule(px, py, x, top + leg.top * s, x, floor, leg.r * s), -0.1]
		})
	]
	let deepest = 0
	let shade = 0
	for (const [distance, light] of parts) {
		if (distance >= deepest) continue
		deepest = distance
		shade =
			-distance < OUTLINE * s
				? INK_SHADE
				: 0.3 +
					light +
					0.55 * Math.min(1, (-distance * 14) / s) +
					0.12 * fbm((px * 5) / s, (py * 5) / s, t * 0.2)
	}
	if (deepest >= 0) return null
	return { material: 'wood', shade: shade * (1 - (f.dim ?? 0)), depth: deepest }
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
