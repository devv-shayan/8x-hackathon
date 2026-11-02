/**
 * Answering a question when the reply is slow: if the app gave up but the server recorded the
 * answer, the class read back stands, instead of an error and a retry that says "already
 * answered". A question still open after a failure is a real failure.
 */
import type { ClassSession } from '@app/contract'
import { answerOrCatchUp } from '@/components/class/shared'
import { api, ApiError } from '@/lib/api'

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }))
jest.mock('@/lib/api', () => {
	class MockApiError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
		}
	}
	return { api: jest.fn(), ApiError: MockApiError }
})

const CLASS_ID = '33333333-3333-4333-8333-333333333333'
const TURN_ID = '44444444-4444-4444-8444-444444444444'

function classWith(outcome: 'skipped' | null): { class: ClassSession } {
	return {
		class: {
			id: CLASS_ID,
			topic_id: '55555555-5555-4555-8555-555555555555',
			youtube_id: null,
			students: [],
			turns: [{ id: TURN_ID, student_id: 'x', question: 'Why?', answer: null, outcome }],
			finished: false,
			concept_results: null,
			reactions: null
		}
	}
}

function failWith(code: string) {
	return new (ApiError as unknown as new (code: string, message: string) => Error)(code, code)
}

beforeEach(() => jest.mocked(api).mockReset())

it('a timed-out skip the server recorded comes back as the class, not an error', async () => {
	jest
		.mocked(api)
		.mockImplementation(((name: string) =>
			name === 'answerTurn'
				? Promise.reject(failWith('timeout'))
				: Promise.resolve(classWith('skipped'))) as never)
	await expect(answerOrCatchUp(CLASS_ID, TURN_ID, { outcome: 'skipped' })).resolves.toEqual(
		classWith('skipped')
	)
	expect(api).toHaveBeenLastCalledWith('getClass', { params: { id: CLASS_ID } })
})

it('"already answered" on a retry reads the class back too', async () => {
	jest
		.mocked(api)
		.mockImplementation(((name: string) =>
			name === 'answerTurn'
				? Promise.reject(failWith('conflict'))
				: Promise.resolve(classWith('skipped'))) as never)
	await expect(answerOrCatchUp(CLASS_ID, TURN_ID, { outcome: 'skipped' })).resolves.toEqual(
		classWith('skipped')
	)
})

it('a timeout with the question still open is still an error', async () => {
	jest
		.mocked(api)
		.mockImplementation(((name: string) =>
			name === 'answerTurn'
				? Promise.reject(failWith('timeout'))
				: Promise.resolve(classWith(null))) as never)
	await expect(answerOrCatchUp(CLASS_ID, TURN_ID, { outcome: 'skipped' })).rejects.toMatchObject({
		code: 'timeout'
	})
})

it('any other failure is passed on without reading the class', async () => {
	jest.mocked(api).mockRejectedValue(failWith('internal'))
	await expect(
		answerOrCatchUp(CLASS_ID, TURN_ID, { outcome: 'answered', answer: 'Because.' })
	).rejects.toMatchObject({ code: 'internal' })
	expect(api).toHaveBeenCalledTimes(1)
})
