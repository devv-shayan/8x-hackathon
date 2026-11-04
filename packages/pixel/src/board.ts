import {
	renderReveal,
	revealColours,
	revealStage,
	type Picture,
	type RevealColours
} from './reveal'

// Runs the class's board on a canvas while a video reads (8X-49): loads the video's thumbnail
// (YouTube serves it to any origin), takes its colours once, and draws the reveal for the
// current progress, the opening's slow field moving at a low frame rate. Ready draws the real
// thumbnail. The app's web build and the page inside the phone's WebView both run this.

export interface BoardState {
	/** The thumbnail: any image the browser may read across origins. */
	src: string
	/** How far the read has got, 0 to 1, from the app's estimate. */
	progress: number
	/** The video is read: show the real picture. */
	ready: boolean
	/** False while the screen is hidden: no frames are drawn. */
	playing: boolean
	/** Reduce Motion: one still frame per stage. */
	still: boolean
}

export interface Board {
	update(next: Partial<BoardState>): void
	stop(): void
}

const FPS = 12
/** The size the thumbnail is read at: plenty for 80 cells across, and quick to sample. */
const SAMPLE_W = 160
const SAMPLE_H = 90

export function startBoard(canvas: HTMLCanvasElement, initial: BoardState): Board {
	const ctx = canvas.getContext('2d')
	let state = initial
	let image: HTMLImageElement | null = null
	let picture: Picture | null = null
	let colours: RevealColours | null = null
	let frame = 0
	let last = 0

	function load(src: string) {
		picture = null
		colours = null
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => {
			if (state.src !== src) return
			const sample = document.createElement('canvas')
			sample.width = SAMPLE_W
			sample.height = SAMPLE_H
			const sctx = sample.getContext('2d')
			if (!sctx) return
			sctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H)
			try {
				const data = sctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
				picture = { data: data.data, width: SAMPLE_W, height: SAMPLE_H }
				colours = revealColours(picture)
			} catch {
				// A picture we may not read: the board stays dark until it's ready.
				picture = null
			}
			image = img
			run()
		}
		img.src = src
	}

	function draw(seconds: number) {
		if (!ctx) return
		if (state.ready && image) {
			canvas.style.imageRendering = 'auto'
			canvas.width = image.naturalWidth || SAMPLE_W
			canvas.height = image.naturalHeight || SAMPLE_H
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
			return
		}
		if (!picture || !colours) return
		canvas.style.imageRendering = 'pixelated'
		const stage = revealStage(state.progress)
		const rows = Math.round((stage.columns * SAMPLE_H) / SAMPLE_W)
		if (canvas.width !== stage.columns || canvas.height !== rows) {
			canvas.width = stage.columns
			canvas.height = rows
		}
		const out = ctx.createImageData(stage.columns, rows)
		renderReveal(out.data, stage.columns, rows, picture, colours, stage, seconds)
		ctx.putImageData(out, 0, 0)
	}

	function tick(now: number) {
		frame = requestAnimationFrame(tick)
		if (now - last < 1000 / FPS) return
		last = now
		draw(now / 1000)
	}

	function run() {
		cancelAnimationFrame(frame)
		const moving = state.playing && !state.still && !state.ready
		if (moving && revealStage(state.progress).contrast < 1) frame = requestAnimationFrame(tick)
		else draw(state.still ? 2 : performance.now() / 1000)
	}

	load(initial.src)

	return {
		update(next) {
			const src = next.src ?? state.src
			const changed = src !== state.src
			state = { ...state, ...next, src }
			if (changed) load(src)
			else run()
		},
		stop() {
			cancelAnimationFrame(frame)
		}
	}
}
