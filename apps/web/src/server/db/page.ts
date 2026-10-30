// Keyset pages for the stores behind /api/app/v1's lists. A page continues after a row id in
// the list's own order, through Prisma's cursor pagination: Postgres compares the sort
// timestamps itself, at their full microsecond precision. A JS Date holds milliseconds, so
// a cursor carrying the timestamp would skip rows written within the same millisecond.

/** At most `limit` rows, after the row `after` (none: the first page). */
export type PageRequest = { limit: number; after?: string }

/** A page, and the id of its last row when there is another page after it. */
export type Page<T> = { rows: T[]; nextAfter: string | null }

/**
 * findMany arguments for a page. Prisma's cursor starts AT the cursor row, and the usual
 * `skip: 1` would drop the wrong row once the cursor row stops matching the filter (deleted
 * since the last page): the row after it would go instead, unseen. So the cursor row is
 * fetched and dropped by id in `toPage`, and one more row than the page says whether
 * another page follows.
 */
export function pageArgs({ limit, after }: PageRequest): {
	take: number
	cursor?: { id: string }
} {
	return after ? { take: limit + 2, cursor: { id: after } } : { take: limit + 1 }
}

export function toPage<T extends { id: string }>(
	rows: T[],
	{ limit, after }: PageRequest
): Page<T> {
	const rest = after && rows[0]?.id === after ? rows.slice(1) : rows
	if (rest.length <= limit) return { rows: rest, nextAfter: null }
	const page = rest.slice(0, limit)
	return { rows: page, nextAfter: page[page.length - 1].id }
}
