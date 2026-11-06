// Renders Maya's and Omar's small portraits from the pixel engine, for the places a live scene
// per row would be too heavy: the app's lists. Run it after changing the students or their
// portrait scenes. They are plain images, so they ship in an update.
//
//   npm run build:portraits --workspace=@app/pixel
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { renderScene, SCENES, studentHeads } from '../index.ts'

const OUT = new URL('../../../apps/mobile/assets/students/', import.meta.url)
/** Dithered cells across the whole scene: the crop below keeps a part of it. */
const SCENE_GRID = 88
/** Dithered cells across the image: head and shoulders, big enough to read at 24pt. */
const GRID = 36
/** How far above the head the crop starts, in cells. */
const HEADROOM = 3
/** Each cell's size in the image: sharp on a phone at the largest place it's shown. */
const SCALE = 4
/** The moment to freeze. */
const FRAME_T = 2.4

function portrait(scene) {
	const cells = new Uint8ClampedArray(SCENE_GRID * SCENE_GRID * 4)
	renderScene(cells, SCENE_GRID, SCENE_GRID, scene, FRAME_T)
	const [head] = studentHeads(scene, SCENE_GRID, SCENE_GRID)
	const left = Math.round(head.x - GRID / 2)
	const top = Math.round(head.top) - HEADROOM
	const px = GRID * SCALE
	const png = new PNG({ width: px, height: px })
	for (let y = 0; y < px; y++) {
		for (let x = 0; x < px; x++) {
			const row = top + Math.floor(y / SCALE)
			const column = left + Math.floor(x / SCALE)
			const from = (row * SCENE_GRID + column) * 4
			const to = (y * px + x) * 4
			png.data[to] = cells[from]
			png.data[to + 1] = cells[from + 1]
			png.data[to + 2] = cells[from + 2]
			png.data[to + 3] = 255
		}
	}
	return PNG.sync.write(png)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(new URL('maya.png', OUT), portrait(SCENES.mayaPortrait))
writeFileSync(new URL('omar.png', OUT), portrait(SCENES.omarPortrait))
console.log('Wrote', fileURLToPath(OUT))
