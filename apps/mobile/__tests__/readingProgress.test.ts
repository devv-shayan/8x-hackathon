import { clock, LONGER_AFTER_SECONDS, readingAt } from '@/lib/readingProgress'

describe('readingAt', () => {
	it('moves through opening, reading and the key ideas, never reaching the end', () => {
		expect(readingAt(0)).toEqual({ step: 'opening', progress: 0, longer: false })
		expect(readingAt(1).step).toBe('opening')
		expect(readingAt(10).step).toBe('reading')
		expect(readingAt(35).step).toBe('ideas')
		expect(readingAt(600).progress).toBeLessThan(1)
	})

	it('only ever goes forward', () => {
		let last = -1
		for (let s = 0; s <= 120; s += 0.5) {
			const { progress } = readingAt(s)
			expect(progress).toBeGreaterThanOrEqual(last)
			last = progress
		}
	})

	it('says when the wait is longer than usual', () => {
		expect(readingAt(LONGER_AFTER_SECONDS - 1).longer).toBe(false)
		expect(readingAt(LONGER_AFTER_SECONDS).longer).toBe(true)
	})
})

it('clock reads minutes and seconds', () => {
	expect(clock(0)).toBe('0:00')
	expect(clock(21.7)).toBe('0:21')
	expect(clock(92)).toBe('1:32')
})
