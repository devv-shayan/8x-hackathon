import type { Progress } from './playback'

// Showing a student's question word by word as they say it (docs/class-scene-requirements.md,
// R10–R13). Orpheus gives no word timings, so each word gets a share of the clip by its length;
// a voice that does say where it is (the browser's) is followed exactly.

/** A speaking pace for a voice whose length isn't known, in words a second. */
export const WORDS_PER_SECOND = 2.8
/** Silence a clip starts and ends with, in seconds, so the first word waits for the voice. */
const LEAD_SECONDS = 0.15
const TAIL_SECONDS = 0.25
/** Every word takes a little time however short it is: the gap after it. */
const WORD_GAP = 2

/** The question's words, in order, with no empty ones. */
export function splitWords(text: string): string[] {
	return text.split(/\s+/).filter(Boolean)
}

/**
 * How many of `words` have been said so far, from 0 to all of them. The last one counted is
 * the word being said now.
 */
export function wordsSaid(words: readonly string[], progress: Progress): number {
	if (words.length === 0) return 0
	if (progress.spokenChars !== undefined) {
		let end = 0
		for (let i = 0; i < words.length; i++) {
			if (progress.spokenChars <= end) return i
			end += words[i]!.length + 1
		}
		return words.length
	}
	const duration = progress.duration ?? words.length / WORDS_PER_SECOND + LEAD_SECONDS
	const speaking = Math.max(0.001, duration - LEAD_SECONDS - TAIL_SECONDS)
	const share = (progress.elapsed - LEAD_SECONDS) / speaking
	if (share < 0) return 0
	const weights = words.map((word) => word.length + WORD_GAP)
	const total = weights.reduce((sum, w) => sum + w, 0)
	let before = 0
	for (let i = 0; i < words.length; i++) {
		// A word appears as the voice starts it.
		if (share < before / total) return i
		before += weights[i]!
	}
	return words.length
}
