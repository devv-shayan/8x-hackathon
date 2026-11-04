import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

// A video's title from YouTube's public oEmbed while it reads, so the board can say what it is
// before our server answers. Best effort: without it, the screen just says it's reading.

const oembedSchema = z.object({ title: z.string().min(1) })

export function useVideoTitle(youtubeId: string | null) {
	return (
		useQuery({
			queryKey: ['youtube-title', youtubeId],
			enabled: youtubeId !== null,
			staleTime: Infinity,
			retry: false,
			queryFn: async ({ signal }) => {
				const watch = `https://www.youtube.com/watch?v=${youtubeId}`
				const response = await fetch(
					`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`,
					{ signal }
				)
				if (!response.ok) return null
				return oembedSchema.safeParse(await response.json()).data?.title ?? null
			}
		}).data ?? null
	)
}
