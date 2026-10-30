import { z } from 'zod'
import { ApiError } from './app-errors'

// The `cursor` of every /api/app/v1 list. Opaque to the app, which sends a response's
// `next_cursor` back verbatim: base64url of `{ v, list, id }`, the last row of the page it
// came from. The store continues after that row in the list's own order (Prisma cursor
// pagination, which compares timestamps in Postgres at full precision).
//
// A cursor names its list, so one from another list is a 400, not a quietly empty page. A
// cursor whose row has since gone ends the list: the app loads it again from the top.

const VERSION = 1

export type CursorList = 'items' | 'tasks' | 'activity' | 'notifications'

const cursorSchema = z.object({
	v: z.literal(VERSION),
	list: z.string(),
	id: z.uuid()
})

export function encodeCursor(list: CursorList, id: string): string {
	return Buffer.from(JSON.stringify({ v: VERSION, list, id })).toString('base64url')
}

/** A page's `next_cursor`, from the store's `nextAfter`: null on the last page. */
export function nextCursor(list: CursorList, nextAfter: string | null): string | null {
	return nextAfter ? encodeCursor(list, nextAfter) : null
}

/** The row id to continue after, or undefined for the first page. Throws a 400. */
export function decodeCursor(list: CursorList, cursor: string | undefined): string | undefined {
	if (cursor === undefined) return undefined
	let raw: unknown
	try {
		raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
	} catch {
		throw invalidCursor()
	}
	const parsed = cursorSchema.safeParse(raw)
	if (!parsed.success || parsed.data.list !== list) throw invalidCursor()
	return parsed.data.id
}

function invalidCursor() {
	return new ApiError('invalid_request', 'Some of what was sent is not valid.', {
		issues: [{ path: 'cursor', message: 'Not a next_cursor from this list. Load it again.' }]
	})
}
