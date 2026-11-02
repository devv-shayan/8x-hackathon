// A question longer than Orpheus takes in one request, cut where a reader would pause: between
// sentences, then between words. Each piece is spoken on its own and the clips are joined.

/** `text` in pieces of at most `max` characters, in order, none empty. */
export function splitForSpeech(text: string, max: number): string[] {
	const pieces: string[] = []
	let current = ''
	const push = () => {
		if (current) pieces.push(current)
		current = ''
	}
	for (const sentence of text.trim().split(/(?<=[.!?])\s+/)) {
		for (const part of sentence.length > max ? byWords(sentence, max) : [sentence]) {
			if (current && current.length + 1 + part.length > max) push()
			current = current ? `${current} ${part}` : part
		}
	}
	push()
	return pieces
}

function byWords(sentence: string, max: number): string[] {
	const parts: string[] = []
	let current = ''
	for (const word of sentence.split(/\s+/)) {
		// A single word longer than the limit is cut where it must be.
		for (let start = 0; start < word.length; start += max) {
			const chunk = word.slice(start, start + max)
			if (current && current.length + 1 + chunk.length > max) {
				parts.push(current)
				current = ''
			}
			current = current ? `${current} ${chunk}` : chunk
		}
	}
	if (current) parts.push(current)
	return parts
}
