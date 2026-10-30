import * as Sentry from '@sentry/react-native'
import { consoleSink, createLogger, sentrySink, type LogRecord } from '@/lib/logger'

jest.mock('@sentry/react-native', () => ({
	addBreadcrumb: jest.fn(),
	captureException: jest.fn(),
	captureMessage: jest.fn()
}))

function capture(threshold?: 'debug' | 'info' | 'warn' | 'error' | 'silent') {
	const records: LogRecord[] = []
	const log = createLogger({ sink: (record) => records.push(record), threshold })
	return { log, records }
}

beforeEach(() => jest.clearAllMocks())

describe('createLogger', () => {
	it('drops lines below the threshold', () => {
		const { log, records } = capture('warn')
		log.debug('d')
		log.info('i')
		log.warn('w')
		log.error('e')
		expect(records.map((r) => r.level)).toEqual(['warn', 'error'])
	})

	it('redacts secret-named fields and scrubs the message', () => {
		const { log, records } = capture()
		log.info('signed in as avery.quinn@example.com with Bearer abc.def', {
			accessToken: 'eyJhbGciOi',
			apiKey: 'appl_live',
			userId: 'u-1'
		})
		expect(records[0].message).toBe('signed in as a***@example.com with Bearer [redacted]')
		expect(records[0].fields).toEqual({
			accessToken: '[redacted]',
			apiKey: '[redacted]',
			userId: 'u-1'
		})
	})

	it('serializes an Error for the fields and keeps the original for Sentry', () => {
		const { log, records } = capture()
		const error = Object.assign(new Error('boom at https://x.test/?api_key=live'), { status: 503 })
		log.error('request failed', { error })
		expect(records[0].error).toBe(error)
		expect(records[0].fields.error).toEqual({
			name: 'Error',
			message: 'boom at https://x.test/?api_key=[redacted]',
			status: 503
		})
	})

	it('merges a child logger’s fields under the call’s own', () => {
		const { log, records } = capture()
		log.child({ scope: 'revenuecat', attempt: 1 }).warn('retry', { attempt: 2 })
		expect(records[0].fields).toEqual({ scope: 'revenuecat', attempt: 2 })
	})

	it('never throws, even when the sink does', () => {
		const log = createLogger({
			sink: () => {
				throw new Error('sink down')
			}
		})
		expect(() => log.error('still fine')).not.toThrow()
	})
})

describe('sentrySink (release builds)', () => {
	const record = (overrides: Partial<LogRecord>): LogRecord => ({
		level: 'info',
		message: 'm',
		fields: {},
		...overrides
	})

	it('turns info and warn into breadcrumbs only', () => {
		sentrySink(record({ level: 'warn', message: 'slow', fields: { ms: 900 } }))
		expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
			category: 'log',
			level: 'warning',
			message: 'slow',
			data: { ms: 900 }
		})
		expect(Sentry.captureException).not.toHaveBeenCalled()
		expect(Sentry.captureMessage).not.toHaveBeenCalled()
	})

	it('captures an error with its Error as an exception', () => {
		const error = new Error('render failed')
		sentrySink(record({ level: 'error', message: 'Uncaught', fields: { a: 1 }, error }))
		expect(Sentry.captureException).toHaveBeenCalledWith(error, { extra: { a: 1 } })
		expect(Sentry.captureMessage).not.toHaveBeenCalled()
	})

	it('captures an error without an Error as a message', () => {
		sentrySink(record({ level: 'error', message: 'Invalid config', fields: { invalid: ['X'] } }))
		expect(Sentry.captureMessage).toHaveBeenCalledWith('Invalid config', {
			level: 'error',
			extra: { invalid: ['X'] }
		})
	})
})

describe('consoleSink (development builds)', () => {
	it('prints the message, and the fields when there are any', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
		const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
		consoleSink({ level: 'warn', message: 'w', fields: { a: 1 } })
		consoleSink({ level: 'debug', message: 'd', fields: {} })
		expect(warn).toHaveBeenCalledWith('w', { a: 1 })
		expect(logSpy).toHaveBeenCalledWith('d')
		warn.mockRestore()
		logSpy.mockRestore()
	})
})
