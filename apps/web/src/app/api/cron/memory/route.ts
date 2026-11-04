import { NextResponse, type NextRequest } from 'next/server'
import { MEMORY_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { isCronAuthorized } from '@/server/api/cron-auth'
import { memoryReminderStore } from '@/server/db/memory-reminders'
import { sendExpoPushes, type ExpoPushMessage } from '@/server/memory/expo-push'
import { chooseReminders, stageLabel } from '@/server/memory/reminders'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NOTE_TITLE_LIMIT = 120

/**
 * One reminder per person per day, for the most urgent day mark a gap has
 * reached and not yet sent: 5, 4, 3, 2, 1, and due. The mark written when the
 * due date was set (they were in the app) is already recorded, so it is skipped.
 *
 * Scheduled daily at 09:00 UTC by apps/web/vercel.json, beside the lifecycle sweep.
 * Auth: `Authorization: Bearer <CRON_SECRET>`. Unset, this answers 503.
 * `EXPO_ACCESS_TOKEN` unset also answers 503 once there is a note to send, and
 * sends nothing.
 */
export async function GET(req: NextRequest) {
	const denied = requireCronSecret(req)
	if (denied) return denied

	try {
		const now = new Date()
		const chosen = chooseReminders(await memoryReminderStore.candidates(now), now)
		if (chosen.length === 0) {
			return NextResponse.json({ ok: true, sent: 0 })
		}

		const accessToken = process.env.EXPO_ACCESS_TOKEN
		if (!accessToken) {
			log.error('memory reminders are not configured', { source: 'api/cron/memory' })
			return NextResponse.json(
				{ error: 'Push is not configured on this deployment' },
				{ status: 503 }
			)
		}

		const messages: ExpoPushMessage[] = chosen.flatMap((item) =>
			item.tokens.map((to) => ({
				to,
				title: item.conceptTitle.trim().slice(0, NOTE_TITLE_LIMIT),
				sound: 'default' as const,
				channelId: 'memory',
				data: {
					path: '/memory' as const,
					gap_id: item.gapId,
					stage: stageLabel(item.stage)
				}
			}))
		)
		const receipts = await sendExpoPushes(messages, { token: accessToken })
		const accepted = new Set(receipts.ok)
		const delivered = chosen.filter((item) => item.tokens.some((token) => accepted.has(token)))

		await memoryReminderStore.recordSends(delivered, now)
		await memoryReminderStore.deleteTokens(receipts.dead)
		for (const item of delivered) {
			await recordUserEvent(item.userId, MEMORY_EVENTS.sent, {
				path: '/memory',
				metadata: { gap_id: item.gapId, stage: stageLabel(item.stage) },
				dedupeMatch: { gap_id: item.gapId, stage: stageLabel(item.stage) }
			})
		}

		log.info('memory reminders sent', {
			source: 'api/cron/memory',
			sent: delivered.length,
			deadTokens: receipts.dead.length
		})
		return NextResponse.json({ ok: true, sent: delivered.length })
	} catch (err) {
		log.error('memory reminders failed', { source: 'api/cron/memory', err })
		return NextResponse.json({ error: 'Memory reminders failed' }, { status: 500 })
	}
}

function requireCronSecret(req: NextRequest): NextResponse | null {
	const secret = process.env.CRON_SECRET
	if (!secret) {
		return NextResponse.json(
			{ error: 'Cron is not configured on this deployment' },
			{ status: 503 }
		)
	}
	if (!isCronAuthorized(req.headers.get('authorization'), secret)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	return null
}
