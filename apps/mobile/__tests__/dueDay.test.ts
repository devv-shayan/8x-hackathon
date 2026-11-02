import { dueDay } from '@/lib/dueDay'

describe('dueDay', () => {
	const now = new Date('2026-11-02T09:00:00Z')

	it('says today for anything due now or past', () => {
		expect(dueDay('2026-11-02T08:00:00Z', now)).toBe('today')
		expect(dueDay('2026-10-30T08:00:00Z', now)).toBe('today')
	})

	it('names the weekday within the week, and the date after', () => {
		const weekday = new Date('2026-11-04T09:00:00Z').toLocaleDateString(undefined, {
			weekday: 'long'
		})
		expect(dueDay('2026-11-04T09:00:00Z', now)).toBe(weekday)
		expect(dueDay('2026-11-20T09:00:00Z', now)).not.toBe(weekday)
		expect(dueDay('2026-11-20T09:00:00Z', now)).toMatch(/20/)
	})
})
