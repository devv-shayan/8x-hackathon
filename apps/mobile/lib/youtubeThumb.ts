/** YouTube's public thumbnail for a video id — no extra API or schema. */
export function youtubeThumbnailUrl(youtubeId: string) {
	return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}
