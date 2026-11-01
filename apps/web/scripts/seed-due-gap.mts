import { PrismaClient } from '@prisma/client'
import { seedDueGap } from '@/server/db/seed-due-gap'

// Writes one past class with a gap that is already due, for the signed-in account.
// Usage: npm run db:seed-due-gap -- <user-id>

const userId = process.argv[2]?.trim()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

if (!userId || !UUID.test(userId)) {
	console.error('Usage: npm run db:seed-due-gap -- <user-id>')
	console.error('The id is the signed-in account. Sign in once before running this.')
	process.exit(1)
}

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!databaseUrl) {
	console.error('DATABASE_URL is not set. Run this with apps/web/.env.local present.')
	process.exit(1)
}

const client = new PrismaClient({ datasourceUrl: databaseUrl })

try {
	const seeded = await seedDueGap(client, { userId })
	console.log(
		seeded.created
			? `Due warm-up ready. topic ${seeded.topicId}, gap ${seeded.gapId}`
			: `Due warm-up already there. topic ${seeded.topicId}, gap ${seeded.gapId}`
	)
} catch (error) {
	const message = error instanceof Error ? error.message : String(error)
	console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://…'))
	process.exitCode = 1
} finally {
	await client.$disconnect()
}
