import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseReminders, dayMark, stageLabel, type ReminderCandidate } from './reminders'

const NOW = new Date('2026-11-04T09:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function at(days: number): Date {
	return new Date(NOW.getTime() + days * DAY)
}

function row(
	patch: Partial<ReminderCandidate> & Pick<ReminderCandidate, 'gapId'>
): ReminderCandidate {
	return {
		userId: 'user-1',
		conceptTitle: 'Herd immunity',
		dueAt: at(2),
		handledStages: [],
		sentToday: false,
		tokens: ['ExponentPushToken[one]'],
		...patch
	}
}

test('a mark is the days left, rounding a partial day up, and 0 once due', () => {
	assert.equal(dayMark(at(5), NOW), 5)
	assert.equal(dayMark(new Date(at(4).getTime() + 60 * 60 * 1000), NOW), 5)
	assert.equal(dayMark(at(4), NOW), 4)
	assert.equal(dayMark(at(1), NOW), 1)
	assert.equal(dayMark(NOW, NOW), 0)
	assert.equal(dayMark(new Date(NOW.getTime() - 1), NOW), 0)
	assert.equal(stageLabel(0), 'due')
	assert.equal(stageLabel(4), '4')
})

test('the mark that was just scheduled is not sent again', () => {
	const chosen = chooseReminders([row({ gapId: 'g1', dueAt: at(2), handledStages: [2] })], NOW)
	assert.deepEqual(chosen, [])
})

test('a fresh gap only reaches day 2, so the next day is day 1', () => {
	const chosen = chooseReminders([row({ gapId: 'g1', dueAt: at(1), handledStages: [2] })], NOW)
	assert.equal(chosen[0]?.stage, 1)
	assert.deepEqual(chosen[0]?.stagesToRecord, [1])
})

test('the next day sends that mark, and a missed run sends only the most urgent one', () => {
	const chosen = chooseReminders([row({ gapId: 'g1', dueAt: at(2), handledStages: [5] })], NOW)
	assert.equal(chosen.length, 1)
	assert.equal(chosen[0]?.stage, 2)
	assert.deepEqual(chosen[0]?.stagesToRecord, [4, 3, 2])
})

test('one person gets the more urgent idea, and a tie goes to the older one', () => {
	const urgent = chooseReminders(
		[
			row({ gapId: 'later', dueAt: at(4), conceptTitle: 'Later' }),
			row({ gapId: 'due', dueAt: at(0), conceptTitle: 'Due' })
		],
		NOW
	)
	assert.equal(urgent[0]?.gapId, 'due')

	const tie = chooseReminders(
		[
			row({ gapId: 'newer', dueAt: at(0), conceptTitle: 'Newer' }),
			row({ gapId: 'older', dueAt: new Date(NOW.getTime() - DAY), conceptTitle: 'Older' })
		],
		NOW
	)
	assert.equal(tie[0]?.gapId, 'older')
})

test('a note already sent today, or a phone with no token, sends nothing', () => {
	assert.deepEqual(chooseReminders([row({ gapId: 'g1', dueAt: at(0), sentToday: true })], NOW), [])
	assert.deepEqual(chooseReminders([row({ gapId: 'g1', dueAt: at(0), tokens: [] })], NOW), [])
})

test('two people each get their own note', () => {
	const chosen = chooseReminders(
		[
			row({ gapId: 'a', userId: 'user-a', dueAt: at(1) }),
			row({ gapId: 'b', userId: 'user-b', dueAt: at(0) })
		],
		NOW
	)
	assert.deepEqual(chosen.map((item) => item.userId).sort(), ['user-a', 'user-b'])
})
