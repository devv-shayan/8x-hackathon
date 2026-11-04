import { splitWords, wordsSaid, WORDS_PER_SECOND } from '@/lib/voice/reveal'

const words = splitWords('How can thirty days make time memorable?')

describe('wordsSaid', () => {
	it('shows nothing before the voice starts, and every word once it ends', () => {
		expect(wordsSaid(words, { elapsed: 0, duration: 3 })).toBe(0)
		expect(wordsSaid(words, { elapsed: 3, duration: 3 })).toBe(words.length)
	})

	it('shows the first word as the voice starts it, then more as it goes', () => {
		expect(wordsSaid(words, { elapsed: 0.16, duration: 3 })).toBe(1)
		const half = wordsSaid(words, { elapsed: 1.5, duration: 3 })
		expect(half).toBeGreaterThan(1)
		expect(half).toBeLessThan(words.length)
	})

	it('gives long words more time than short ones', () => {
		const long = splitWords('a extraordinarily b')
		// "a" goes by quickly: a third of the way in, the long word is already being said.
		expect(wordsSaid(long, { elapsed: 0.15 + 0.6 * (1 / 3), duration: 1 })).toBe(2)
	})

	it('waits with the voice: the same position gives the same words', () => {
		const at = { elapsed: 1.2, duration: 3 }
		expect(wordsSaid(words, at)).toBe(wordsSaid(words, { ...at }))
	})

	it('keeps a speaking pace when the length is unknown', () => {
		const end = words.length / WORDS_PER_SECOND + 0.15
		expect(wordsSaid(words, { elapsed: 0.1, duration: null })).toBe(0)
		expect(wordsSaid(words, { elapsed: end, duration: null })).toBe(words.length)
	})

	it('follows a voice that says where it is', () => {
		// "How can " is 8 characters; the voice is starting "thirty".
		expect(wordsSaid(words, { elapsed: 0, duration: null, spokenChars: 9 })).toBe(3)
		expect(wordsSaid(words, { elapsed: 0, duration: null, spokenChars: 0 })).toBe(0)
		expect(wordsSaid(words, { elapsed: 0, duration: null, spokenChars: 999 })).toBe(words.length)
	})

	it('has nothing to show for an empty question', () => {
		expect(splitWords('  ')).toEqual([])
		expect(wordsSaid([], { elapsed: 5, duration: 3 })).toBe(0)
	})
})
