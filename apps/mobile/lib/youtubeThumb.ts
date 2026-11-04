/** YouTube's public thumbnail for a video id — no extra API or schema. */
export function youtubeThumbnailUrl(youtubeId: string) {
	return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

/**
 * The 16:9 thumbnail, with no black bars, for the class's board while a video reads. YouTube
 * serves it to any origin, so the board can read its pixels.
 */
export function youtubeBoardUrl(youtubeId: string) {
	return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
}
