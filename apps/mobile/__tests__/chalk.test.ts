import { chalkOpacity, dueIdeaId, FAINT_CHALK, fadeStage, nextReminder } from '@/lib/chalk'
import type { MemoryIdea } from '@app/contract'

const NOW = new Date('2026-11-04T00:00:00.000Z')

function idea(partial: Partial<MemoryIdea>): MemoryIdea {
	return {
		gap_id: '44444444-4444-4444-8444-444444444444',
		topic_id: '33333333-3333-4333-8333-333333333333',
		topic_title: 'Vaccines',
		concept_title: 'Herd immunity',
		closed: false,
		next_due_at: '2026-11-06T00:00:00.000Z',
		judged: false,
		...partial
	}
}

describe('chalk opacity', () => {
	it('keeps a closed idea full', () => {
		expect(chalkOpacity(idea({ closed: true, next_due_at: null }), NOW)).toBe(1)
	})

	it('starts a fresh gap at full chalk and a due gap at the faintest', () => {
		expect(
			chalkOpacity(idea({ next_due_at: '2026-11-06T00:00:00.000Z', judged: false }), NOW)
		).toBe(1)
		expect(chalkOpacity(idea({ next_due_at: '2026-11-01T00:00:00.000Z' }), NOW)).toBe(FAINT_CHALK)
	})

	it('fades a fresh gap harder by the day before it is due', () => {
		const opacity = chalkOpacity(
			idea({ next_due_at: '2026-11-05T00:00:00.000Z', judged: false }),
			NOW
		)
		expect(opacity).toBeCloseTo(0.475)
		expect(opacity).toBeLessThan(0.5)
	})

	it('leaves a wrong answer, due again in two days, between full and faint', () => {
		const opacity = chalkOpacity(
			idea({ next_due_at: '2026-11-06T00:00:00.000Z', judged: true }),
			NOW
		)
		expect(opacity).toBeGreaterThan(FAINT_CHALK)
		expect(opacity).toBeLessThan(1)
	})

	it('picks the oldest due idea', () => {
		const older = idea({
			gap_id: '11111111-1111-4111-8111-111111111111',
			next_due_at: '2026-11-01T00:00:00.000Z'
		})
		const newer = idea({
			gap_id: '22222222-2222-4222-8222-222222222222',
			next_due_at: '2026-11-03T00:00:00.000Z'
		})
		const waiting = idea({
			gap_id: '33333333-3333-4333-8333-333333333333',
			next_due_at: '2026-11-09T00:00:00.000Z'
		})
		expect(dueIdeaId([newer, waiting, older], NOW)).toBe('11111111-1111-4111-8111-111111111111')
	})
})

describe('fade stage', () => {
	it('has none for a closed idea', () => {
		expect(fadeStage(idea({ closed: true, next_due_at: null }), NOW)).toBeNull()
	})

	it('puts a fresh gap on a two-day ruler and a judged one on five', () => {
		expect(fadeStage(idea({ next_due_at: '2026-11-05T00:00:00.000Z' }), NOW)).toEqual({
			window: 2,
			daysLeft: 1,
			daysPassed: 1
		})
		expect(fadeStage(idea({ next_due_at: '2026-11-06T12:00:00.000Z', judged: true }), NOW)).toEqual(
			{ window: 5, daysLeft: 3, daysPassed: 2 }
		)
	})

	it('ends a due idea at the last square', () => {
		expect(fadeStage(idea({ next_due_at: '2026-11-01T00:00:00.000Z', judged: true }), NOW)).toEqual(
			{ window: 5, daysLeft: 0, daysPassed: 5 }
		)
	})
})

describe('next reminder', () => {
	// 08:00 UTC: the job runs at 09:00 today.
	const MORNING = new Date('2026-11-04T08:00:00.000Z')

	it('names the most urgent idea for the next run', () => {
		const soon = idea({ gap_id: 'soon', next_due_at: '2026-11-05T10:00:00.000Z' })
		const later = idea({ gap_id: 'later', next_due_at: '2026-11-07T10:00:00.000Z' })
		const next = nextReminder([later, soon], MORNING)
		expect(next?.idea.gap_id).toBe('soon')
		expect(next?.at.toISOString()).toBe('2026-11-04T09:00:00.000Z')
	})

	it("moves to tomorrow once today's run has passed", () => {
		const next = nextReminder(
			[idea({ next_due_at: '2026-11-06T10:00:00.000Z' })],
			new Date('2026-11-04T10:00:00.000Z')
		)
		expect(next?.at.toISOString()).toBe('2026-11-05T09:00:00.000Z')
	})

	it('skips an idea that had its last note, one too far off, and a closed one', () => {
		const longDue = idea({ gap_id: 'old', next_due_at: '2026-11-01T00:00:00.000Z' })
		const farOff = idea({ gap_id: 'far', next_due_at: '2026-11-20T00:00:00.000Z' })
		const kept = idea({ gap_id: 'kept', closed: true, next_due_at: null })
		expect(nextReminder([longDue, farOff, kept], MORNING)).toBeNull()
	})
})
