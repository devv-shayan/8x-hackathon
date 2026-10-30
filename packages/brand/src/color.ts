/**
 * Colour maths for the brand package: parsing, alpha, OKLab/OKLCH, mixing and
 * WCAG contrast. Dependency-free so both apps (and the Tailwind config loader)
 * can run it.
 *
 * Why OKLCH: lightness in OKLCH tracks perceived lightness closely, so "move
 * this accent darker until it reads on paper" keeps the hue and feels like the
 * same colour, where the same move in HSL drifts toward mud or neon.
 */

/** 0–255 channels, alpha 0–1. */
export interface Rgba {
	r: number
	g: number
	b: number
	a: number
}

/** OKLCH: l 0–1, c ≥ 0 (sRGB tops out near 0.37), h in degrees. */
export interface Oklch {
	l: number
	c: number
	h: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number, places = 3) => Math.round(v * 10 ** places) / 10 ** places

/** Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` (comma or space syntax). */
export function parseColor(input: string): Rgba {
	const s = input.trim().toLowerCase()
	if (s.startsWith('#')) {
		let hex = s.slice(1)
		if (hex.length === 3 || hex.length === 4) {
			hex = hex
				.split('')
				.map((ch) => ch + ch)
				.join('')
		}
		if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) throw new Error(`Invalid hex colour: ${input}`)
		return {
			r: parseInt(hex.slice(0, 2), 16),
			g: parseInt(hex.slice(2, 4), 16),
			b: parseInt(hex.slice(4, 6), 16),
			a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
		}
	}
	const fn = /^rgba?\(([^)]+)\)$/.exec(s)
	if (fn?.[1]) {
		const parts = fn[1]
			.replace('/', ' ')
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number)
		const [r, g, b, a = 1] = parts
		if ([r, g, b, a].some((n) => n === undefined || Number.isNaN(n))) {
			throw new Error(`Invalid rgb colour: ${input}`)
		}
		return { r: r!, g: g!, b: b!, a: a! }
	}
	throw new Error(`Unsupported colour format: ${input}`)
}

const hex2 = (n: number) =>
	Math.round(clamp(n, 0, 255))
		.toString(16)
		.padStart(2, '0')

/** `#rrggbb` (alpha dropped — use withAlpha for translucent colours). */
export function toHex(color: string | Rgba): string {
	const c = typeof color === 'string' ? parseColor(color) : color
	return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`
}

/** The same colour at a given opacity, as `rgba(r,g,b,a)`. Works on hex and rgb() input. */
export function withAlpha(color: string, alpha: number): string {
	const c = parseColor(color)
	return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${round(clamp(alpha, 0, 1))})`
}

/** Space-separated channels for CSS custom properties: `"12 34 56"`. */
export function toChannels(color: string): string {
	const c = parseColor(color)
	return `${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}`
}

/** Alpha of a colour string (1 for hex without alpha). */
export function alphaOf(color: string): number {
	return parseColor(color).a
}

/** Paint `fg` (possibly translucent) over an opaque `bg`; returns the visible colour as hex. */
export function composite(fg: string, bg: string): string {
	const f = parseColor(fg)
	const b = parseColor(bg)
	const a = f.a
	return toHex({
		r: f.r * a + b.r * (1 - a),
		g: f.g * a + b.g * (1 - a),
		b: f.b * a + b.b * (1 - a),
		a: 1
	})
}

// ── sRGB ↔ linear ─────────────────────────────────────────────────────────────

const toLinear = (v255: number) => {
	const v = v255 / 255
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const fromLinear = (v: number) => {
	const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
	return s * 255
}

/** WCAG 2.x relative luminance (alpha ignored). */
export function luminance(color: string): number {
	const c = parseColor(color)
	return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b)
}

/**
 * WCAG contrast ratio of `fg` on `bg`. A translucent `fg` is composited over
 * `bg` first — which is what the eye sees. `bg` is treated as opaque; pass an
 * already-composited colour when the ground itself is translucent.
 */
export function contrast(fg: string, bg: string): number {
	const solidBg = toHex(bg)
	const visible = alphaOf(fg) < 1 ? composite(fg, solidBg) : fg
	const l1 = luminance(visible)
	const l2 = luminance(solidBg)
	const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
	return (hi + 0.05) / (lo + 0.05)
}

// ── OKLab / OKLCH (Björn Ottosson) ────────────────────────────────────────────

function linearToOklab(r: number, g: number, b: number): [number, number, number] {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	]
}

function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	]
}

export function toOklch(color: string): Oklch {
	const c = parseColor(color)
	const [L, a, b] = linearToOklab(toLinear(c.r), toLinear(c.g), toLinear(c.b))
	const chroma = Math.sqrt(a * a + b * b)
	const hue = chroma < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
	return { l: L, c: chroma, h: hue }
}

const inGamut = ([r, g, b]: [number, number, number]) =>
	[r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4)

function lchToLinear({ l, c, h }: Oklch): [number, number, number] {
	const rad = (h * Math.PI) / 180
	return oklabToLinear(l, c * Math.cos(rad), c * Math.sin(rad))
}

/**
 * OKLCH → `#rrggbb`. Out-of-gamut colours keep their lightness and hue and
 * lose chroma until they fit sRGB (a binary search), rather than clipping a
 * channel and shifting hue.
 */
export function fromOklch(o: Oklch): string {
	const l = clamp(o.l, 0, 1)
	let lin = lchToLinear({ l, c: o.c, h: o.h })
	if (!inGamut(lin)) {
		let lo = 0
		let hi = o.c
		for (let i = 0; i < 24; i++) {
			const mid = (lo + hi) / 2
			if (inGamut(lchToLinear({ l, c: mid, h: o.h }))) lo = mid
			else hi = mid
		}
		lin = lchToLinear({ l, c: lo, h: o.h })
	}
	return toHex({
		r: fromLinear(clamp(lin[0], 0, 1)),
		g: fromLinear(clamp(lin[1], 0, 1)),
		b: fromLinear(clamp(lin[2], 0, 1)),
		a: 1
	})
}

/** Shorthand: `oklch(0.62, 0.14, 250)` → hex. */
export function oklch(l: number, c: number, h: number): string {
	return fromOklch({ l, c, h })
}

/** Perceptual mix in OKLab. t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
	const ca = parseColor(a)
	const cb = parseColor(b)
	const la = linearToOklab(toLinear(ca.r), toLinear(ca.g), toLinear(ca.b))
	const lb = linearToOklab(toLinear(cb.r), toLinear(cb.g), toLinear(cb.b))
	const k = clamp(t, 0, 1)
	const [L, A, B] = [0, 1, 2].map((i) => la[i]! + (lb[i]! - la[i]!) * k) as [number, number, number]
	const lin = oklabToLinear(L, A, B)
	return toHex({
		r: fromLinear(clamp(lin[0], 0, 1)),
		g: fromLinear(clamp(lin[1], 0, 1)),
		b: fromLinear(clamp(lin[2], 0, 1)),
		a: 1
	})
}

/** Shift OKLCH lightness by `delta` (−1…1), keeping hue; chroma is gamut-mapped. */
export function shiftLightness(color: string, delta: number): string {
	const o = toOklch(color)
	return fromOklch({ ...o, l: o.l + delta })
}

/** Lowest contrast of `fg` across several grounds. */
export function minContrast(fg: string, grounds: readonly string[]): number {
	return Math.min(...grounds.map((g) => contrast(fg, g)))
}

/**
 * Move `color`'s OKLCH lightness — hue held — until it reaches `target`
 * contrast on every ground in `grounds`. Returns it unchanged when it already
 * passes. `direction` defaults to away from the first ground's lightness.
 * If the target is unreachable the extreme (lightest/darkest) is returned and
 * the caller's contrast test will say so.
 */
export function ensureContrast(
	color: string,
	grounds: readonly string[],
	target: number,
	direction?: 'lighten' | 'darken'
): string {
	const base = toHex(color)
	if (minContrast(base, grounds) >= target) return base
	const o = toOklch(base)
	const dir = direction ?? (luminance(grounds[0]!) < 0.18 ? 'lighten' : 'darken')
	const step = dir === 'lighten' ? 0.005 : -0.005
	let candidate = base
	for (let l = o.l + step; l >= 0 && l <= 1; l += step) {
		candidate = fromOklch({ ...o, l })
		if (minContrast(candidate, grounds) >= target) return candidate
	}
	return candidate
}

/** Of several candidates, the one with the highest contrast on `bg`. */
export function mostContrasting(bg: string, candidates: readonly string[]): string {
	let best = candidates[0]!
	let bestRatio = -1
	for (const c of candidates) {
		const r = contrast(c, bg)
		if (r > bestRatio) {
			best = c
			bestRatio = r
		}
	}
	return best
}
