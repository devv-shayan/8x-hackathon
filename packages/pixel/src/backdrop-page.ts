import { startBackdrop, type BackdropState } from './backdrop'
import { startBoard, type BoardState } from './board'

// The page inside the phone's WebView: a full-screen canvas running the same backdrop as the
// web build, or, when the app passes a `board`, the class's board for a video being read. The
// app sets `window.__initial` before this runs and calls `window.__backdrop` with each change.

type PageState = BackdropState | (Omit<BoardState, 'src'> & { board: BoardState['src'] })

declare global {
	interface Window {
		__initial?: PageState
		__backdrop?: (
			next: Partial<BackdropState> & Partial<{ board: string; progress: number; ready: boolean }>
		) => void
	}
}

const canvas = document.getElementById('backdrop') as HTMLCanvasElement
const initial = window.__initial

if (initial && 'board' in initial) {
	const board = startBoard(canvas, { ...initial, src: initial.board })
	window.__backdrop = ({ board: src, ...next }) =>
		board.update({ ...next, ...(src ? { src } : {}) })
} else {
	const backdrop = startBackdrop(
		canvas,
		(initial as BackdropState | undefined) ?? {
			scene: 'home',
			raised: {},
			playing: true,
			still: false
		}
	)
	window.__backdrop = (next) => backdrop.update(next)
}
