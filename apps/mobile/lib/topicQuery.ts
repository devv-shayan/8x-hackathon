/** Cached after a successful video read so Explain can show the title without a new API. */
export function topicQueryKey(topicId: string) {
	return ['topic', topicId] as const
}
