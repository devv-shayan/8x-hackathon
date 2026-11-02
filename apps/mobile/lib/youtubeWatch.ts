/** Opens the video at a moment, or from the start when seconds are unknown. */
export function youtubeWatchUrl(youtubeId: string, startSeconds?: number | null) {
	const base = `https://www.youtube.com/watch?v=${youtubeId}`
	if (startSeconds == null || startSeconds <= 0) return base
	return `${base}&t=${Math.floor(startSeconds)}`
}
