// 3D simplex noise and fractal sums of it, for the landing page's generative backgrounds.
// Seeded and pure, so the same seed always draws the same field and the tests can pin it.

const GRADIENTS = [
	[1, 1, 0],
	[-1, 1, 0],
	[1, -1, 0],
	[-1, -1, 0],
	[1, 0, 1],
	[-1, 0, 1],
	[1, 0, -1],
	[-1, 0, -1],
	[0, 1, 1],
	[0, -1, 1],
	[0, 1, -1],
	[0, -1, -1]
] as const

const F3 = 1 / 3
const G3 = 1 / 6
/** Scales simplex noise to roughly -1..1. */
const SIMPLEX_SCALE = 32
/** Park–Miller multiplier and modulus for the permutation shuffle. */
const LCG_MULTIPLIER = 16807
const LCG_MODULUS = 2147483647

function permutation(seed: number): Uint8Array {
	const order = Array.from({ length: 256 }, (_, i) => i)
	let state = seed
	for (let i = 255; i > 0; i--) {
		state = (state * LCG_MULTIPLIER) % LCG_MODULUS
		const j = state % (i + 1)
		const swap = order[i]!
		order[i] = order[j]!
		order[j] = swap
	}
	const table = new Uint8Array(512)
	for (let i = 0; i < 512; i++) table[i] = order[i & 255]!
	return table
}

export type Noise3 = (x: number, y: number, z: number) => number

/** Simplex noise in three dimensions, roughly -1..1. The third axis is usually time. */
export function createSimplex(seed = 11): Noise3 {
	const perm = permutation(seed)
	const corner = (x: number, y: number, z: number, i: number, j: number, k: number): number => {
		let t = 0.6 - x * x - y * y - z * z
		if (t <= 0) return 0
		const g = GRADIENTS[perm[i + perm[j + perm[k]!]!]! % 12]!
		t *= t
		return t * t * (g[0] * x + g[1] * y + g[2] * z)
	}
	return (x, y, z) => {
		const s = (x + y + z) * F3
		const i = Math.floor(x + s)
		const j = Math.floor(y + s)
		const k = Math.floor(z + s)
		const t = (i + j + k) * G3
		const x0 = x - i + t
		const y0 = y - j + t
		const z0 = z - k + t
		let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number
		if (x0 >= y0) {
			if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0]
			else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1]
			else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1]
		} else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1]
		else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1]
		else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0]
		const ii = i & 255
		const jj = j & 255
		const kk = k & 255
		return (
			SIMPLEX_SCALE *
			(corner(x0, y0, z0, ii, jj, kk) +
				corner(x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, ii + i1, jj + j1, kk + k1) +
				corner(x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, ii + i2, jj + j2, kk + k2) +
				corner(x0 - 0.5, y0 - 0.5, z0 - 0.5, ii + 1, jj + 1, kk + 1))
		)
	}
}

/** Three octaves of simplex noise: soft shapes with a little detail. */
export function createFbm(seed = 11): Noise3 {
	const noise = createSimplex(seed)
	return (x, y, z) =>
		0.6 * noise(x, y, z) + 0.3 * noise(2 * x, 2 * y, z * 1.3) + 0.1 * noise(4 * x, 4 * y, z * 1.7)
}
