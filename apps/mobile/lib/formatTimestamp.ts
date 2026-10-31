const SECONDS_PER_MINUTE = 60

/** A position in a video, as M:SS. */
export function formatTimestamp(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
	const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0')
	return `${minutes}:${seconds}`
}
