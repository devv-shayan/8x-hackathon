import { ditherIndex, hexToRgb, type Rgb } from './dither'
import { PIXEL_FIELDS, type PixelFieldName } from './fields'
import { FIGURE_COLOURS, figureAt, type Figure } from './students'

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
 * behind the sheet, shrunk only if the room above it is too short for them: so a tall sheet
 * never hides them.
 */
export function placeStudents(
	scene: Scene,
	floor?: number | null
): { headY: number; scale: number } {
	if (floor == null) return { headY: scene.headY, scale: scene.scale }
	const room = floor - CEILING
	const scale = Math.max(0, Math.min(scene.scale, room / (ABOVE_HEAD + BELOW_HEAD - BEHIND)))
	return { headY: floor + BEHIND * scale - BELOW_HEAD * scale, scale }
}

/** Students raise the hand on the outside, so two raised hands never cross in the middle. */
function figures(scene: Scene, aspect: number, raised: Raised, floor?: number | null): Figure[] {
	const { headY, scale } = placeStudents(scene, floor)
	return scene.students.map((student, i) => ({
		name: student.name,
		material: student.name === 'Maya' ? 'maya' : 'omar',
		hand: student.at > 0.5 || (student.at === 0.5 && student.name === 'Maya') ? 1 : -1,
		cx: student.at * aspect,
		headY,
		scale,
		lift: raised[student.name] ?? 0,
		blinkPhase: i * 0.37
	}))
}

/** Draws one frame of `scene` into RGBA `pixels`, `width` by `height`. */
export function renderScene(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
	scene: Scene,
	t: number,
	raised: Raised = {},
	floor?: number | null
): void {
	const aspect = width / height
	const field = PIXEL_FIELDS[scene.field].field
	const fieldColours = FIELD_COLOURS[scene.field]
	const people = figures(scene, aspect, raised, floor)
	// Where each halo sits: the middle of the student's head and chest.
	const pools = people.map((f) => [f.cx, f.headY + 0.16 * f.scale, 0.3 * f.scale] as const)
	for (let y = 0; y < height; y++) {
		const py = y / height
		for (let x = 0; x < width; x++) {
			const px = x / height
			let colour: Rgb | undefined
			let depth = 0
			for (const f of people) {
				const hit = figureAt(px, py, t, f)
				if (hit && hit.depth < depth) {
					depth = hit.depth
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

/** A box around each student, in the same units as `width` and `height`, for tap targets. */
export function studentBounds(
	scene: Scene,
	width: number,
	height: number,
	floor?: number | null
): { name: StudentName; left: number; top: number; width: number; height: number }[] {
	const aspect = width / height
	return figures(scene, aspect, {}, floor).map((f) => {
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
