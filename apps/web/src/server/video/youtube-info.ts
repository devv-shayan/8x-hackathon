import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import { log } from '@/server/lib/logger'
import { parseCaptions } from './captions'
import type { TranscriptSegment } from './transcript'

// A video's title, length and captions, through yt-dlp. Everything here is best effort: yt-dlp
// may not be installed, YouTube may rate-limit it, and a video may have no captions. Each of
// those leaves a gap for read-video.ts to fill, so nothing here throws.

const run = promisify(execFile)

const TIMEOUT_MS = 60_000
const MAX_OUTPUT_BYTES = 1024 * 1024
// In the order to try them. `uvx` runs yt-dlp without installing it.
const COMMANDS = [['yt-dlp'], ['uvx', '--quiet', 'yt-dlp']] as const
// `en` is the video's own captions when it has them, otherwise YouTube's auto-generated ones.
const CAPTION_LANGUAGES = 'en,en-US,en-GB'
const INFO_FORMAT = '%(.{title,duration})j'

const infoSchema = z.object({ title: z.string(), duration: z.number().nullish() })

export type YouTubeInfo = {
	title: string
	durationSeconds: number | null
	/** Null when the video has no English captions, or they couldn't be fetched. */
	segments: TranscriptSegment[] | null
	/** YouTube refused the captions for now, so a retry may find some. */
	captionsRateLimited: boolean
}

type RunResult = { stdout: string; stderr: string }

async function runYtDlp(args: string[], cwd: string): Promise<RunResult | null> {
	for (const [command, ...prefix] of COMMANDS) {
		try {
			return await run(command, [...prefix, ...args], {
				cwd,
				timeout: TIMEOUT_MS,
				maxBuffer: MAX_OUTPUT_BYTES
			})
		} catch (error) {
			const failed = z
				.object({ code: z.unknown(), stdout: z.string(), stderr: z.string() })
				.safeParse(error).data
			// Not installed: try the next command. Otherwise yt-dlp ran, and a rate limit on the
			// captions still leaves the title and length in stdout.
			if (failed && failed.code !== 'ENOENT') return failed
		}
	}
	return null
}

async function readCaptions(directory: string): Promise<TranscriptSegment[] | null> {
	const files = (await readdir(directory)).filter((file) => file.endsWith('.vtt')).sort()
	const [file] = files
	if (!file) return null
	const segments = parseCaptions(await readFile(join(directory, file), 'utf8'))
	return segments.length > 0 ? segments : null
}

function parseInfo(stdout: string) {
	const line = stdout.trim().split('\n').at(-1) ?? ''
	try {
		return infoSchema.safeParse(JSON.parse(line)).data ?? null
	} catch {
		return null
	}
}

/** What yt-dlp can tell us about a video, or null if it couldn't tell us anything. */
export async function fetchYouTubeInfo(videoId: string): Promise<YouTubeInfo | null> {
	const directory = await mkdtemp(join(tmpdir(), 'youtube-info-'))
	try {
		const result = await runYtDlp(
			[
				'--no-warnings',
				'--js-runtimes',
				'node',
				'--no-simulate',
				'--skip-download',
				'--write-subs',
				'--write-auto-subs',
				'--sub-langs',
				CAPTION_LANGUAGES,
				'--sub-format',
				'vtt',
				'--print',
				INFO_FORMAT,
				'-o',
				'captions',
				'--',
				videoId
			],
			directory
		)
		const info = result && parseInfo(result.stdout)
		if (!info) {
			log.warn('yt-dlp returned nothing usable', {
				source: 'video/youtube-info',
				video_id: videoId
			})
			return null
		}
		const segments = await readCaptions(directory)
		log.info('video info read', {
			source: 'video/youtube-info',
			video_id: videoId,
			has_captions: segments !== null
		})
		return {
			title: info.title,
			durationSeconds: info.duration ?? null,
			segments,
			captionsRateLimited: segments === null && (result?.stderr ?? '').includes('429')
		}
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
}
