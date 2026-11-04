// The landing page's generative backgrounds and pixel students: deterministic, bounded, and
// always drawn from their own palettes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BAYER_4, ditherIndex, hexToRgb, renderField } from './dither'
import { createFbm, createSimplex } from './noise'
import { PIXEL_FIELDS } from './fields'
import { FIGURE_COLOURS, figureAt, SEATS, shadeAt } from './students'
import { placeStudents, renderScene, SCENES, studentBounds } from './scenes'
import { BACKDROP_HTML } from './backdrop-html.generated'
import { luminance, renderReveal, revealColours, revealStage } from './reveal'
import { readFileSync } from 'node:fs'

test('noise is seeded: the same seed gives the same field, another seed a different one', () => {
	const a = createSimplex(7)
	const b = createSimplex(7)
	const c = createSimplex(8)
	const points = [
		[0.1, 0.2, 0.3],
		[1.7, -2.4, 5.5],
		[12.3, 4.4, 0.9]
	] as const
	for (const [x, y, z] of points) assert.equal(a(x, y, z), b(x, y, z))
	assert.ok(points.some(([x, y, z]) => a(x, y, z) !== c(x, y, z)))
})

test('fractal noise stays roughly within -1..1', () => {
	const fbm = createFbm()
	for (let i = 0; i < 2000; i++) {
		const v = fbm(i * 0.137, i * 0.071, i * 0.013)
		assert.ok(v > -1.2 && v < 1.2, `${v}`)
	}
})

test('the Bayer thresholds are sixteen distinct values between 0 and 1', () => {
	assert.equal(new Set(BAYER_4).size, 16)
	assert.ok(BAYER_4.every((v) => v > 0 && v < 1))
})

test('dithering clamps to the palette and mixes neighbours in between', () => {
	assert.equal(ditherIndex(-3, 0, 0, 5), 0)
	assert.equal(ditherIndex(7, 0, 0, 5), 4)
	const half = new Set<number>()
	for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) half.add(ditherIndex(0.5 / 4, x, y, 5))
	assert.deepEqual([...half].sort(), [0, 1])
})

test('a hex colour becomes its channels, and anything else is refused', () => {
	assert.deepEqual(hexToRgb('#f7fe62'), [247, 254, 98])
	assert.throws(() => hexToRgb('lime'))
})

test('every background draws only its own palette colours, opaque', () => {
	for (const [name, { palette, field }] of Object.entries(PIXEL_FIELDS)) {
		const colours = palette.map(hexToRgb)
		const allowed = new Set(colours.map((c) => c.join(',')))
		const width = 24
		const height = 16
		const pixels = new Uint8ClampedArray(width * height * 4)
		renderField(pixels, width, height, field, colours, 3.3)
		for (let o = 0; o < pixels.length; o += 4) {
			assert.ok(allowed.has(`${pixels[o]},${pixels[o + 1]},${pixels[o + 2]}`), name)
			assert.equal(pixels[o + 3], 255, name)
		}
	}
})

test('every background gives finite values at any moment', () => {
	for (const [name, { field }] of Object.entries(PIXEL_FIELDS)) {
		for (const t of [0, 4, 61.7]) {
			for (const [x, y] of [
				[0, 0],
				[0.5, 0.5],
				[0.99, 0.99]
			] as const) {
				assert.ok(Number.isFinite(field(x, y, t, 1.6)), `${name} at ${x},${y},${t}`)
			}
		}
	}
})

test('a raised hand is lime, and a lowered one is not', () => {
	const aspect = 4 / 3
	const maya = SEATS[0]
	// Where Maya's hand is when fully raised: beside her head, towards the middle.
	const handX = maya.at * aspect + maya.hand * (0.15 + 0.07)
	const handY = 0.22
	assert.equal(shadeAt(handX, handY, aspect, 0, [1, 0]).material, 'raisedHand')
	assert.notEqual(shadeAt(handX, handY, aspect, 0, [0, 0]).material, 'raisedHand')
})

test('each student is drawn in their own colour, and the desk sits below them', () => {
	const aspect = 4 / 3
	for (const seat of SEATS) {
		assert.equal(shadeAt(seat.at * aspect, 0.77, aspect, 0, [0, 0]).material, seat.material)
	}
	assert.equal(shadeAt(0.02, 0.97, aspect, 0, [0, 0]).material, 'desk')
})

test('every scene draws only its background and student colours, opaque', () => {
	for (const [name, scene] of Object.entries(SCENES)) {
		const width = 40
		const height = 80
		const pixels = new Uint8ClampedArray(width * height * 4)
		renderScene(pixels, width, height, scene, 2.5, { Maya: 1, Omar: 1 })
		const allowed = new Set(
			[
				...PIXEL_FIELDS[scene.field].palette.map(hexToRgb),
				...Object.values(FIGURE_COLOURS).flat()
			].map((c) => c.join(','))
		)
		for (let o = 0; o < pixels.length; o += 4) {
			assert.equal(pixels[o + 3], 255, `${name} is opaque`)
			assert.ok(allowed.has(`${pixels[o]},${pixels[o + 1]},${pixels[o + 2]}`), `${name} colour`)
		}
	}
})

test("a scene's students stand where it puts them, with a hand up on request", () => {
	const scene = SCENES.classroom
	const width = 402
	const height = 874
	const aspect = width / height
	for (const box of studentBounds(scene, width, height)) {
		const student = scene.students.find((s) => s.name === box.name)!
		const f = {
			name: box.name,
			material: box.name === 'Maya' ? ('maya' as const) : ('omar' as const),
			hand: student.at > 0.5 ? (1 as const) : (-1 as const),
			cx: student.at * aspect,
			headY: scene.headY,
			scale: scene.scale,
			lift: 1,
			blinkPhase: 0
		}
		// The chest is inside the student and inside their tap box.
		const chestY = scene.headY + 0.4 * scene.scale
		assert.equal(figureAt(f.cx, chestY, 0, f)?.material, f.material)
		assert.ok(box.left < f.cx * height && f.cx * height < box.left + box.width)
		assert.ok(box.top < chestY * height && chestY * height < box.top + box.height)
		// The raised hand is lime.
		const handX = f.cx + f.hand * (0.15 + 0.07) * scene.scale
		const handY = scene.headY + (0.49 - 0.64) * scene.scale
		assert.equal(figureAt(handX, handY, 0, f)?.material, 'raisedHand')
	}
})

test("the WebView's page is built from the current engine", async () => {
	const { generatedModule } = await import('../scripts/build-backdrop.mjs')
	const onDisk = readFileSync(new URL('./backdrop-html.generated.ts', import.meta.url), 'utf8')
	// The committed file is LF. Git on Windows checks it out as CRLF, and the
	// generator writes LF, so a raw compare fails here while the page is current.
	assert.equal(
		onDisk.replaceAll('\r\n', '\n'),
		generatedModule(),
		'run `npm run build:backdrop --workspace=@app/pixel`'
	)
})

test("the WebView's page runs: it starts a backdrop and takes updates", () => {
	const html: string = BACKDROP_HTML
	const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
	const drawn: number[] = []
	const canvas = {
		clientWidth: 402,
		clientHeight: 874,
		width: 0,
		height: 0,
		getContext: () => ({
			createImageData: (w: number, h: number) => ({
				width: w,
				height: h,
				data: new Uint8ClampedArray(w * h * 4)
			}),
			putImageData: (image: { width: number }) => drawn.push(image.width)
		})
	}
	const window: Record<string, unknown> = {
		__initial: { scene: 'classroom', raised: { Omar: 1 }, playing: false, still: true }
	}
	const document = { getElementById: () => canvas }
	new Function(
		'window',
		'document',
		'requestAnimationFrame',
		'cancelAnimationFrame',
		'performance',
		script
	)(
		window,
		document,
		() => 0,
		() => {},
		{ now: () => 0 }
	)
	assert.equal(typeof window.__backdrop, 'function')
	assert.equal(canvas.width, Math.round(402 / 5))
	;(window.__backdrop as (s: object) => void)({ scene: 'results' })
	assert.equal(canvas.width, Math.round(402 / 4))
	assert.equal(drawn.length, 2)
})

test('with a floor, students stand just above the sheet, smaller only when they must', () => {
	const scene = SCENES.classroom
	const roomy = placeStudents(scene, 0.62)
	assert.equal(roomy.scale, scene.scale)
	assert.ok(Math.abs(roomy.headY + 0.62 * roomy.scale - 0.62) < 0.08 * roomy.scale + 1e-9)
	const tall = placeStudents(scene, 0.42)
	assert.ok(tall.scale < scene.scale)
	// The raised hand stays below the screen's floating buttons.
	assert.ok(tall.headY - 0.2 * tall.scale >= 0.16 - 1e-9)
	assert.deepEqual(placeStudents(scene), { headY: scene.headY, scale: scene.scale })
})

test("the app's icons, its splash and the website's favicon are drawn from the current engine", async () => {
	const { ICONS, ICON_DIR, iconFile } = await import('../scripts/build-icons.mjs')
	for (const name of Object.keys(ICONS)) {
		const onDisk = readFileSync(new URL(name, ICON_DIR))
		assert.ok(
			Buffer.compare(onDisk, iconFile(name)) === 0,
			`${name} is stale: run \`npm run build:icons --workspace=@app/pixel\``
		)
	}
})

/** A 32x18 picture: green, with a white bar across the middle third (like a title). */
function titleCard() {
	const width = 32
	const height = 18
	const data = new Uint8ClampedArray(width * height * 4)
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const o = (y * width + x) * 4
			const white = y >= 6 && y < 12
			data[o] = white ? 250 : 59
			data[o + 1] = white ? 250 : 180
			data[o + 2] = white ? 245 : 74
			data[o + 3] = 255
		}
	return { data, width, height }
}

test("the board's ramp is built from the thumbnail's dominant colour, dark to light", () => {
	const colours = revealColours(titleCard())
	const [r, g, b] = colours.dominant
	assert.ok(Math.abs(r - 59) < 4 && Math.abs(g - 180) < 4 && Math.abs(b - 74) < 4, 'green wins')
	assert.deepEqual(colours.ramp[2], colours.dominant)
	const lights = colours.ramp.map(luminance)
	for (let i = 1; i < lights.length; i++) assert.ok(lights[i]! > lights[i - 1]!, 'ramp goes up')
})

test('the board opens as a field of the dominant colour and brings the picture out of it', () => {
	const picture = titleCard()
	const colours = revealColours(picture)
	const columns = 32
	const rows = 18
	// Clamped arrays round halves to even, so a pixel is within a step of its ramp colour.
	const inRamp = (r: number, g: number, b: number) =>
		colours.ramp.some(
			(c) => Math.abs(c[0] - r) <= 1 && Math.abs(c[1] - g) <= 1 && Math.abs(c[2] - b) <= 1
		)
	const draw = (progress: number) => {
		const pixels = new Uint8ClampedArray(columns * rows * 4)
		renderReveal(pixels, columns, rows, picture, colours, revealStage(progress), 1)
		return pixels
	}
	const lightAt = (pixels: Uint8ClampedArray, y: number) => {
		let sum = 0
		for (let x = 0; x < columns; x++) {
			const o = (y * columns + x) * 4
			sum += luminance([pixels[o]!, pixels[o + 1]!, pixels[o + 2]!])
		}
		return sum / columns
	}
	const opening = draw(0)
	const half = draw(0.55)
	for (const pixels of [opening, half])
		for (let o = 0; o < pixels.length; o += 4) {
			assert.ok(inRamp(pixels[o]!, pixels[o + 1]!, pixels[o + 2]!), 'only the ramp')
			assert.equal(pixels[o + 3], 255)
		}
	// Opening: the title row is about as bright as the rest. Halfway: clearly brighter.
	assert.ok(Math.abs(lightAt(opening, 9) - lightAt(opening, 2)) < 0.15)
	assert.ok(lightAt(half, 9) - lightAt(half, 2) > 0.3)
})

test('the board gets finer and more detailed as the read goes on', () => {
	const steps = [0, 0.15, 0.35, 0.55, 0.75, 0.9].map(revealStage)
	assert.equal(steps[0]!.contrast, 0)
	for (let i = 1; i < steps.length; i++) {
		assert.ok(steps[i]!.columns >= steps[i - 1]!.columns)
		assert.ok(steps[i]!.contrast >= steps[i - 1]!.contrast)
	}
	assert.equal(steps.at(-1)!.hues, 1)
})
