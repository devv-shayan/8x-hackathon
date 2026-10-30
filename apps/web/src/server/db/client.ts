import 'server-only'
import { PrismaClient } from '@prisma/client'

// The one file allowed to import @prisma/client at runtime (eslint.config.mjs,
// docs/rules/database.md). Queries live in the stores beside it (profiles.ts, play-stats.ts,
// analytics.ts, leads.ts, and items.ts, tasks.ts, feed.ts for /api/app/v1); a route or a page
// imports a store, never `db`, and ESLint refuses `db` from this module anywhere outside
// src/server/db/.
//
// Re-exported so callers that need the Prisma namespace at runtime (Prisma.DbNull to clear a
// nullable Json column, Prisma.* input types) get it from here rather than reaching for the
// banned package directly. From template-web.
export { Prisma } from '@prisma/client'

// Connects as DATABASE_URL's role, the owner of the tables (so RLS, on with no policies,
// does not gate it). Constructing the client opens nothing: it connects on the first query.
//
// Cached on globalThis outside production so hot reloads during `next dev` don't open a
// fresh connection pool on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = db
}
