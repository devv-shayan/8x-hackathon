// The landing page's generative backgrounds and pixel students: deterministic, bounded, and
// always drawn from their own palettes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BAYER_4, ditherIndex, hexToRgb, renderField } from './dither'
import { createFbm, createSimplex } from './noise'
import { PIXEL_FIELDS } from './fields'
import { SEATS, shadeAt } from './students'

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
