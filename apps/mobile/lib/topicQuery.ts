/** Cached after a successful video read so Explain can show the title without a new API. */
export function topicQueryKey(topicId: string) {
	return ['topic', topicId] as const
}

/** Reading a video or pasted text: the warm-up screen watches it to say when the video is ready. */
export const READ_VIDEO_KEY = ['read-video'] as const
