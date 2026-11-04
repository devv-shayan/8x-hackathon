import { startBackdrop, type BackdropState } from './backdrop'

// The page inside the phone's WebView: a full-screen canvas running the same backdrop as the
// web build. The app sets `window.__initial` before this runs and calls `window.__backdrop`
// with each change.

declare global {
	interface Window {
		__initial?: BackdropState
		__backdrop?: (next: Partial<BackdropState>) => void
	}
}

const canvas = document.getElementById('backdrop') as HTMLCanvasElement
const backdrop = startBackdrop(
	canvas,
	window.__initial ?? { scene: 'home', raised: {}, playing: true, still: false }
)
window.__backdrop = (next) => backdrop.update(next)
