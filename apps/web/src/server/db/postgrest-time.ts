import { Prisma } from './client'

/** A timestamptz as PostgREST rendered it: "2026-09-20T12:34:56.789012+00:00". */
export type PostgrestTimestamp = string

/**
 * A timestamptz column rendered as PostgREST rendered it, for the fields that leave this app
 * in a contract-bound payload: the Play Stats API's /users roster and the lifecycle cron's
 * Play Events.
 *
 * Those fields were PostgREST's text before the move to Prisma, and PostgREST wrote a
 * timestamptz the way Postgres's JSON does, in UTC: microseconds with trailing zeros dropped
 * and a "+00:00" offset ("2026-09-20T12:34:56.789012+00:00"). A JavaScript Date holds
 * milliseconds and prints "Z", so going through one would change the bytes of a v1
 * response (AGENTS.md, non-negotiable 2). So Postgres renders it, in the query. NULL stays
 * NULL. UTC is explicit here, where PostgREST used the session's time zone: the same text on
 * a Supabase database (UTC) and on any other.
 *
 * `column` is SQL, so it only ever takes a literal from the store that calls it, never input.
 */
export function postgrestTime(column: string): Prisma.Sql {
	return Prisma.raw(`to_json(${column} at time zone 'UTC') #>> '{}' || '+00:00'`)
}
