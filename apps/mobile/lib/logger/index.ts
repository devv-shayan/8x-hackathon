import * as Sentry from '@sentry/react-native'
import { redact, scrubString } from './redact'

/**
 * The app's logger. Every log line in app code goes through here; ESLint bans
 * `console.*` everywhere else in apps/mobile.
 *
 * Same shape as the web's Pino logger (`log.info(message, fields)`,
 * `log.child(fields)`), and the same redaction: keys that name a secret
 * (`token`, `apiKey`, `password`, …) are replaced, and credentials or email
 * addresses inside strings are scrubbed, before anything leaves the call.
 *
 * Where lines go:
 * - Development builds: the console (Metro and LogBox), everything from `debug`.
 * - Release builds: Sentry. `info` and `warn` become breadcrumbs, which ride
 *   along with the next crash or error report. `error` is also captured as a
 *   Sentry event: as an exception when an Error is passed (`{ error }` or
 *   `{ err }`), so the stack symbolicates; as a message otherwise. With no
 *   Sentry DSN configured, release lines go nowhere.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>
export type Threshold = LogLevel | 'silent'

export type Logger = {
	debug(message: string, fields?: LogFields): void
	info(message: string, fields?: LogFields): void
	warn(message: string, fields?: LogFields): void
	error(message: string, fields?: LogFields): void
	child(fields: LogFields): Logger
}

/** One prepared line: message scrubbed, fields serialized and redacted. `error`
 *  is the original Error, kept only so Sentry can read its stack. */
export type LogRecord = {
	level: LogLevel
	message: string
	fields: LogFields
	error?: Error
}

export type LogSink = (record: LogRecord) => void

const RANK: Record<Threshold, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }
const MAX_DEPTH = 8
const TRUNCATED = '[truncated]'
const CIRCULAR = '[circular]'

function serializeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
	if (value == null || typeof value === 'string' || typeof value === 'boolean') return value
	if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
	if (typeof value === 'bigint') return value.toString()
	if (typeof value === 'function' || typeof value === 'symbol') return undefined
	if (depth >= MAX_DEPTH) return TRUNCATED
	if (typeof value !== 'object') return String(value)
	if (seen.has(value)) return CIRCULAR
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
	}

	seen.add(value)
	try {
		if (value instanceof Error) {
			// Own enumerable properties are how errors carry their context (a
			// Supabase error's `status` and `code`, RevenueCat's `userCancelled`).
			const fields: LogFields = { name: value.name, message: value.message }
			for (const [name, item] of Object.entries(value)) {
				fields[name] = serializeValue(item, seen, depth + 1)
			}
			if (value.cause != null) fields.cause = serializeValue(value.cause, seen, depth + 1)
			return fields
		}
		if (Array.isArray(value)) return value.map((item) => serializeValue(item, seen, depth + 1))
		const serialized: LogFields = {}
		for (const [name, item] of Object.entries(value)) {
			serialized[name] = serializeValue(item, seen, depth + 1)
		}
		return serialized
	} finally {
		seen.delete(value)
	}
}

function prepare(level: LogLevel, message: string, fields: LogFields): LogRecord {
	const candidate = fields.error ?? fields.err
	const serialized: LogFields = {}
	const seen = new WeakSet<object>()
	for (const [name, value] of Object.entries(fields)) {
		serialized[name] = serializeValue(value, seen, 0)
	}
	return {
		level,
		message: scrubString(message),
		fields: redact(serialized) as LogFields,
		error: candidate instanceof Error ? candidate : undefined
	}
}

/** Development: print to the console, where Metro and LogBox show it. */
export const consoleSink: LogSink = ({ level, message, fields }) => {
	const args: unknown[] = Object.keys(fields).length > 0 ? [message, fields] : [message]
	if (level === 'debug') console.log(...args)
	else console[level](...args)
}

/** Release: breadcrumbs for context, events for errors. */
export const sentrySink: LogSink = ({ level, message, fields, error }) => {
	Sentry.addBreadcrumb({
		category: 'log',
		level: level === 'warn' ? 'warning' : level,
		message,
		data: fields
	})
	if (level !== 'error') return
	if (error) Sentry.captureException(error, { extra: fields })
	else Sentry.captureMessage(message, { level: 'error', extra: fields })
}

export type LoggerOptions = {
	sink?: LogSink
	threshold?: Threshold
	fields?: LogFields
}

export function createLogger(options: LoggerOptions = {}): Logger {
	const sink = options.sink ?? (__DEV__ ? consoleSink : sentrySink)
	const threshold = options.threshold ?? (__DEV__ ? 'debug' : 'info')

	function bind(bound: LogFields): Logger {
		const at =
			(level: LogLevel) =>
			(message: string, fields?: LogFields): void => {
				if (RANK[level] < RANK[threshold]) return
				try {
					sink(prepare(level, message, { ...bound, ...fields }))
				} catch {
					// Logging must never take the app down, and a line that could not
					// be prepared is not sent in its raw form.
				}
			}

		return {
			debug: at('debug'),
			info: at('info'),
			warn: at('warn'),
			error: at('error'),
			child: (fields) => bind({ ...bound, ...fields })
		}
	}
	return bind(options.fields ?? {})
}

export const log = createLogger()
