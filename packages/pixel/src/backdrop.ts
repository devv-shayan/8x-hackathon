import { PIXEL_FIELDS } from './fields'
import { renderScene, SCENES, type Raised, type SceneName } from './scenes'

// Runs a scene on a canvas: sizes it to the screen in the field's cells, draws at a steady
// frame rate, eases hands up and down, and stops drawing while paused. The website-style
// canvas in the app's web build and the page inside the phone's WebView both run this, so a
// scene moves the same on every platform.

export interface BackdropState {
	scene: SceneName
	raised: Raised
	/** False while the screen is hidden or not focused: no frames are drawn. */
	playing: boolean
	/** Reduce Motion: one frame, hands already where they're going. */
	still: boolean
	/** Where the sheet's top edge is, as a share of the height, so students stand above it. */
	floor?: number | null
}

export interface Backdrop {
	update(next: Partial<BackdropState>): void
	stop(): void
}

const FPS = 24
/** How fast a hand moves towards where it's going, per second. */
const HAND_SPEED = 6

export function startBackdrop(canvas: HTMLCanvasElement, initial: BackdropState): Backdrop {
	const ctx = canvas.getContext('2d')
	let state = initial
	let lifts: Raised = { ...initial.raised }
	let image: ImageData | null = null
	let frame = 0
	let last = 0

	function size() {
		const cell = PIXEL_FIELDS[SCENES[state.scene].field].cell
		const width = Math.max(8, Math.round(canvas.clientWidth / cell))
		const height = Math.max(8, Math.round(canvas.clientHeight / cell))
		if (canvas.width !== width || canvas.height !== height || !image) {
			canvas.width = width
			canvas.height = height
			image = ctx ? ctx.createImageData(width, height) : null
		}
	}

	function draw(seconds: number) {
		if (!ctx || !image) return
		renderScene(
			image.data,
			image.width,
			image.height,
			SCENES[state.scene],
			seconds,
			lifts,
			state.floor
		)
		ctx.putImageData(image, 0, 0)
	}

	function tick(now: number) {
		frame = requestAnimationFrame(tick)
		if (now - last < 1000 / FPS) return
		const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
		last = now
		const ease = Math.min(1, dt * HAND_SPEED)
		const next: Raised = {}
		for (const { name } of SCENES[state.scene].students) {
			const target = state.raised[name] ?? 0
			const at = lifts[name] ?? 0
			next[name] = at + (target - at) * ease
		}
		lifts = next
		draw(now / 1000)
	}

	function run() {
		cancelAnimationFrame(frame)
		last = 0
		size()
		if (state.still) {
			lifts = { ...state.raised }
			draw(4)
		} else if (state.playing) {
			frame = requestAnimationFrame(tick)
		} else {
			draw(performance.now() / 1000)
		}
	}

	const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run)
	resize?.observe(canvas)
	run()

	return {
		update(next) {
			state = { ...state, ...next, raised: next.raised ?? state.raised }
			run()
		},
		stop() {
			cancelAnimationFrame(frame)
			resize?.disconnect()
		}
	}
}
