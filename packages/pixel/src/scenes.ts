import { ditherIndex, hexToRgb, type Rgb } from './dither'
import { PIXEL_FIELDS, type PixelFieldName } from './fields'
import {
	DESK,
	deskAt,
	FIGURE_COLOURS,
	figureAt,
	HEAD_RADIUS,
	SEATED_FEET,
	type Figure
} from './students'

// The app's scenes: one of the website's backgrounds behind each step of the loop, with Maya
// and Omar standing in it where the step needs them. Positions are shares of the screen, so
// one scene fits every phone; the white sheet covers the lower part, so students stand in the
// top half.

export type StudentName = Figure['name']

export interface SceneStudent {
	name: StudentName
	/** Where they stand, as a share of the width. */
	at: number
}

export interface Scene {
	field: PixelFieldName
	students: readonly SceneStudent[]
	/** Head height and size, as shares of the screen's height. 1 is the website hero's size. */
	headY: number
	scale: number
	/**
	 * The field value a pool of light (or dark) behind each student is pulled towards, so they
	 * read on a busy background. Null leaves the field alone.
	 */
	halo: number | null
}

const BOTH: readonly SceneStudent[] = [
	{ name: 'Maya', at: 0.3 },
	{ name: 'Omar', at: 0.7 }
]

export const SCENES = {
	/** Onboarding's ground, behind the two student cards. */
	meet: { field: 'tunnel', students: [], headY: 0, scale: 0, halo: null },
	/** The first screen: both students on the tunnel, taking turns with a hand up. */
	welcome: { field: 'tunnel', students: BOTH, headY: 0.32, scale: 0.44, halo: null },
	/**
	 * The cards on "Meet your class": each student on their own colour. The cards are tall and
	 * narrow, so the students are small enough for a raised hand to fit across one.
	 */
	mayaCard: {
		field: 'maya',
		students: [{ name: 'Maya', at: 0.5 }],
		headY: 0.62,
		scale: 0.62,
		halo: 0.99
	},
	omarCard: {
		field: 'omar',
		students: [{ name: 'Omar', at: 0.5 }],
		headY: 0.62,
		scale: 0.62,
		halo: 0.99
	},
	/** A small square portrait, as on Home's warm-up card: head and shoulders. */
	mayaPortrait: {
		field: 'maya',
		students: [{ name: 'Maya', at: 0.5 }],
		headY: 0.48,
		scale: 0.9,
		halo: 0.99
	},
	omarPortrait: {
		field: 'omar',
		students: [{ name: 'Omar', at: 0.5 }],
		headY: 0.48,
		scale: 0.9,
		halo: 0.99
	},
	home: { field: 'limeEdges', students: [], headY: 0, scale: 0, halo: null },
	/** A warm-up: the student who asks, alone on the black band's tunnel. */
	warmUpMaya: {
		field: 'tunnel',
		students: [{ name: 'Maya', at: 0.5 }],
		headY: 0.3,
		scale: 0.5,
		halo: null
	},
	warmUpOmar: {
		field: 'tunnel',
		students: [{ name: 'Omar', at: 0.5 }],
		headY: 0.3,
		scale: 0.5,
		halo: null
	},
	explain: { field: 'voiceWaves', students: [], headY: 0, scale: 0, halo: null },
	classroom: { field: 'goldDrift', students: BOTH, headY: 0.32, scale: 0.44, halo: 0.97 },
	results: { field: 'warmUpRipples', students: BOTH, headY: 0.2, scale: 0.32, halo: 0.99 },
	topic: { field: 'omar', students: [], headY: 0, scale: 0, halo: null }
} as const satisfies Record<string, Scene>

export type SceneName = keyof typeof SCENES

/** Each student's hand, 0 down to 1 up. Students left out have their hand down. */
export type Raised = Partial<Record<StudentName, number>>

const FIELD_COLOURS = Object.fromEntries(
	Object.entries(PIXEL_FIELDS).map(([name, f]) => [name, f.palette.map(hexToRgb)])
) as Record<PixelFieldName, Rgb[]>

/** The top of the room: below the screen's floating buttons, as a share of its height. */
const CEILING = 0.16
/** How far students stand behind the sheet's top edge, in their own heights. */
const BEHIND = 0.08
/** A student's height above the head's centre with a hand up, and below it to the waist. */
const ABOVE_HEAD = 0.2
const BELOW_HEAD = 0.62

/**
 * Where a scene's students stand. Without a `floor` they stand where the scene puts them.
 * With one (the share of the height where the sheet's top edge is), they stand on it, just
 * behind the sheet, shrunk only if the room between it and the `ceiling` is too short for them:
 * so a tall sheet never hides them.
 */
export function placeStudents(
	scene: Scene,
	floor?: number | null,
	ceiling: number = CEILING
): { headY: number; scale: number } {
	if (floor == null) return { headY: scene.headY, scale: scene.scale }
	const room = floor - Math.max(CEILING, ceiling)
	const scale = Math.max(0, Math.min(scene.scale, room / (ABOVE_HEAD + BELOW_HEAD - BEHIND)))
	return { headY: floor + BEHIND * scale - BELOW_HEAD * scale, scale }
}

/**
 * Who is asking in the class, if anyone, and whether their voice is playing. With a stage the
 * asker stands in front under a narrow light and the others sit at desks, smaller and in shadow;
 * with nobody asking, everyone sits. Without one, a scene draws exactly as it always has.
 */
export interface Stage {
	asking: StudentName | null
	talking: boolean
	/**
	 * Where the room's top is, as a share of the height, when something covers the top of the
	 * screen (the question's speech bubble): students stand below it, smaller if they must.
	 */
	ceiling?: number | null
}

/** A seated student's size next to a standing one: further back in the room. */
const SEATED_SCALE = 0.68
/** How far the asker steps in from their seat towards the middle, and the seated lean out. */
const STEP_IN = 0.2
const SIT_OUT = 0.15
/** How far into shadow a seated student is while someone else asks. */
const SEATED_DIM = 0.3
/** The stage light: the dark room's share of its brightness, and the beam's width. */
const ROOM_DARK = 0.34
const BEAM = { top: 0.035, spread: 0.095, edge: 120, pool: 0.07 }

/** Students raise the hand on the outside, so two raised hands never cross in the middle. */
function figures(
	scene: Scene,
	aspect: number,
	raised: Raised,
	floor?: number | null,
	stage?: Stage | null
): Figure[] {
	const { headY, scale } = placeStudents(scene, floor, stage?.ceiling ?? CEILING)
	// Where a seated student's shoes go: just above the sheet, or where a standing one's waist is.
	const feet = (floor ?? headY + (BELOW_HEAD - BEHIND) * scale) - 0.008
	return scene.students.map((student, i) => {
		const base: Figure = {
			name: student.name,
			material: student.name === 'Maya' ? 'maya' : 'omar',
			hand: student.at > 0.5 || (student.at === 0.5 && student.name === 'Maya') ? 1 : -1,
			cx: student.at * aspect,
			headY,
			scale,
			lift: raised[student.name] ?? 0,
			blinkPhase: i * 0.37
		}
		if (!stage) return base
		if (stage.asking === student.name)
			return {
				...base,
				cx: (student.at + (0.5 - student.at) * STEP_IN) * aspect,
				lift: 0,
				talking: stage.talking
			}
		const seated = scale * SEATED_SCALE
		return {
			...base,
			pose: 'seated',
			cx: (student.at + (student.at - 0.5) * SIT_OUT) * aspect,
			scale: seated,
			headY: feet - SEATED_FEET * seated,
			dim: stage.asking ? SEATED_DIM : 0
		}
	})
}

/** Back to front: a seated body, their desk, what rests on the desk, then anyone standing. */
function layerOf(f: Figure, front?: boolean) {
	if (f.pose !== 'seated') return 3
	return front ? 2 : 1
}

/** Draws one frame of `scene` into RGBA `pixels`, `width` by `height`. */
export function renderScene(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
	scene: Scene,
	t: number,
	raised: Raised = {},
	floor?: number | null,
	stage?: Stage | null
): void {
	const aspect = width / height
	const field = PIXEL_FIELDS[scene.field].field
	const fieldColours = FIELD_COLOURS[scene.field]
	const people = figures(scene, aspect, raised, floor, stage)
	const asker = stage?.asking ? people.find((f) => f.name === stage.asking) : undefined
	const seated = people.filter((f) => f.pose === 'seated')
	// Where each halo sits: the middle of the student's head and chest. On a stage, only the
	// asker gets one while asking; the seated stay in the room's shadow.
	const pools = (asker ? [asker] : people).map(
		(f) => [f.cx, f.headY + 0.16 * f.scale, 0.3 * f.scale] as const
	)
	const lightFloor = floor ?? 1
	for (let y = 0; y < height; y++) {
		const py = y / height
		for (let x = 0; x < width; x++) {
			const px = x / height
			let colour: Rgb | undefined
			let layer = 0
			let depth = 0
			for (const f of people) {
				const hit = figureAt(px, py, t, f)
				if (!hit) continue
				const l = layerOf(f, hit.front)
				if (l > layer || (l === layer && hit.depth < depth)) {
					layer = l
					depth = hit.depth
					const palette = FIGURE_COLOURS[hit.material]
					colour = palette[ditherIndex(hit.shade, x, y, palette.length)]
				}
			}
			if (layer < 2) {
				for (const f of seated) {
					const hit = deskAt(px, py, t, f)
					if (!hit) continue
					layer = 1.5
					const palette = FIGURE_COLOURS[hit.material]
					colour = palette[ditherIndex(hit.shade, x, y, palette.length)]
				}
			}
			if (!colour) {
				let value = field(x / width, py, t, aspect)
				if (scene.halo !== null) {
					for (const [hx, hy, r] of pools) {
						const d = Math.hypot(px - hx, (py - hy) * 0.85)
						const pull = 1 / (1 + Math.exp((d - r) * 60))
						value = value * (1 - pull) + scene.halo * pull
					}
				}
				if (asker) {
					// The stage light: a beam on the asker, widening to a pool at the sheet.
					const half = BEAM.top + BEAM.spread * py
					const beam =
						sigmoid((half - Math.abs(px - asker.cx)) * BEAM.edge) * sigmoid((lightFloor - py) * 80)
					const pool = sigmoid(
						(BEAM.pool - Math.hypot((px - asker.cx) * 0.8, (py - lightFloor) * 4)) * 60
					)
					const light = Math.max(beam, pool)
					value = value * ROOM_DARK * (1 - light) + (0.78 + 0.22 * value) * light
				}
				for (const f of seated) {
					// Each desk's shadow on the floor.
					const feet = f.headY + SEATED_FEET * f.scale
					const reach = Math.hypot(
						(px - f.cx) / (DESK.half * 1.35 * f.scale),
						(py - feet - 0.006) / (0.04 * f.scale)
					)
					value *= 1 - 0.5 * sigmoid((1 - reach) * 8)
				}
				colour = fieldColours[ditherIndex(value, x, y, fieldColours.length)]
			}
			const o = (y * width + x) * 4
			pixels[o] = colour![0]
			pixels[o + 1] = colour![1]
			pixels[o + 2] = colour![2]
			pixels[o + 3] = 255
		}
	}
}

function sigmoid(v: number) {
	return 1 / (1 + Math.exp(-v))
}

/** A box around each student, in the same units as `width` and `height`, for tap targets. */
export function studentBounds(
	scene: Scene,
	width: number,
	height: number,
	floor?: number | null,
	stage?: Stage | null
): { name: StudentName; left: number; top: number; width: number; height: number }[] {
	const aspect = width / height
	return figures(scene, aspect, {}, floor, stage).map((f) => {
		if (f.pose === 'seated') {
			// From the raised hand down to the shoes, as wide as the desk.
			const half = DESK.half * f.scale
			const top = f.headY - 0.22 * f.scale
			return {
				name: f.name,
				left: (f.cx - half) * height,
				top: top * height,
				width: 2 * half * height,
				height: (SEATED_FEET + 0.22) * f.scale * height
			}
		}
		const half = 0.26 * f.scale
		const top = f.headY - 0.42 * f.scale
		return {
			name: f.name,
			left: (f.cx - half) * height,
			top: top * height,
			width: 2 * half * height,
			height: Math.min(1 - top, 1.04 * f.scale) * height
		}
	})
}

/**
 * Where each student's head is, in the same units as `width` and `height`: its centre and its
 * top, for a speech bubble's tail, and the top of a raised hand, so a bubble can stay clear.
 */
export function studentHeads(
	scene: Scene,
	width: number,
	height: number,
	floor?: number | null,
	stage?: Stage | null
): { name: StudentName; x: number; top: number; reach: number }[] {
	const aspect = width / height
	return figures(scene, aspect, {}, floor, stage).map((f) => ({
		name: f.name,
		x: f.cx * height,
		top: (f.headY - HEAD_RADIUS * f.scale) * height,
		reach: (f.headY - (f.pose === 'seated' ? 0.2 : HEAD_RADIUS) * f.scale) * height
	}))
}
