import { z } from 'zod'

// /api/app/v1/videos: reading a YouTube video.
//
// POST videos → the video's title, its transcript with timestamps, and the key
//               concepts everything later is measured against. Takes up to a
//               minute or so. A video the app can't use answers 422
//               `video_unreadable`, with a message to show.

export const transcriptSegmentSchema = z.object({
	start_seconds: z.number().int().min(0),
	text: z.string()
})

export const keyConceptSchema = z.object({
	title: z.string(),
	quote: z.string(),
	start_seconds: z.number().int().min(0)
})

export const videoSchema = z.object({
	youtube_id: z.string(),
	title: z.string(),
	segments: z.array(transcriptSegmentSchema),
	concepts: z.array(keyConceptSchema)
})

export const readVideoBody = z.object({ url: z.string().trim().min(1).max(500) }).strict()

export const readVideoResponse = z.object({ video: videoSchema })

export type Video = z.infer<typeof videoSchema>
export type KeyConcept = z.infer<typeof keyConceptSchema>
