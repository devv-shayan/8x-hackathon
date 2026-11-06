/** FNV-1a: small, and the same on every phone, so a person's mark never changes. */
export function hashOf(text: string) {
	let hash = 2166136261
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

export const MARK_SIZE = 11
/** Of 100, how many cells are lit: dense enough to read as a shape, open enough to have one. */
const MARK_FILL = 55

/** A mirrored block of cells drawn from an id: rows of lit or not, left to right. */
export function personalMarkCells(id: string): boolean[][] {
	return Array.from({ length: MARK_SIZE }, (_, y) =>
		Array.from({ length: MARK_SIZE }, (_, x) => {
			const mirrored = Math.min(x, MARK_SIZE - 1 - x)
			return hashOf(`${id}:${mirrored}:${y}`) % 100 < MARK_FILL
		})
	)
}

/** A barcode drawn from an id: bars as `x` and `width`, as far as `totalWidth` goes. */
export function barcodeBars(id: string, totalWidth: number) {
	const bars: { x: number; width: number }[] = []
	let x = 0
	for (let i = 0; ; i++) {
		const hash = hashOf(`${id}#${i}`)
		const width = 2 + (hash % 3) * 2
		if (x + width > totalWidth) return bars
		bars.push({ x, width })
		x += width + 2 + ((hash >>> 4) % 3) * 2
	}
}

/** "Oct 2026", or null for an account with no date. */
export function teachingSince(createdAt: string | null | undefined) {
	return createdAt
		? new Date(createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
		: null
}
