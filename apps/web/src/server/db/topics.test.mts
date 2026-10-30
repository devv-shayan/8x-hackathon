import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// The topic store on a real database: that a topic is the person's own, that saving a video
// twice keeps the first read, and that a stored row which no longer parses is an error. Needs
// TEST_DATABASE_URL, like ./app-data.test.mts; without it the suite skips.
const url = process.env.TEST_DATABASE_URL

const SEGMENTS = [{ startSeconds: 12, text: 'Plants make their own food.' }]
const CONCEPTS = [
	{ title: 'Photosynthesis', quote: 'Plants make their own food', startSeconds: 12 }
]
const TOPIC = {
	youtubeId: 'sQK3Yr4Sc_k',
	title: 'Photosynthesis',
	segments: SEGMENTS,
	concepts: CONCEPTS
}

describe(
	'the topic store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		const sam = randomUUID()
		const alex = randomUUID()
		let topics: import('./topics').TopicStore

		const signUp = (id: string) =>
			base.$executeRaw`
				insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`

		before(async () => {
			const { createTopicStore } = await import('./topics')
			topics = createTopicStore(base)
			await signUp(sam)
			await signUp(alex)
		})

		after(async () => {
			await base.$executeRaw`delete from auth.users where id in (${sam}::uuid, ${alex}::uuid)`
			await base.$disconnect()
		})

		test('a saved topic comes back whole, for its owner only', async () => {
			const saved = await topics.save(sam, TOPIC)
			assert.deepEqual(await topics.find(sam, TOPIC.youtubeId), saved)
			assert.deepEqual(saved.segments, SEGMENTS)
			assert.deepEqual(saved.concepts, CONCEPTS)
			assert.equal(await topics.find(alex, TOPIC.youtubeId), null)
		})

		test('saving a video again keeps the first read', async () => {
			const first = await topics.find(sam, TOPIC.youtubeId)
			const second = await topics.save(sam, { ...TOPIC, title: 'A later read' })
			assert.deepEqual(second, first)
		})

		test('two people can each have the same video', async () => {
			const samsTopic = await topics.find(sam, TOPIC.youtubeId)
			const alexsTopic = await topics.save(alex, TOPIC)
			assert.notEqual(alexsTopic.id, samsTopic?.id)
		})

		test('a stored row that no longer parses is an error', async () => {
			const youtubeId = 'aaaaaaaaaaa'
			await base.topic.create({
				data: { userId: sam, youtubeId, title: 'Broken', segments: [{ text: 1 }], concepts: [] }
			})
			await assert.rejects(topics.find(sam, youtubeId))
		})

		test("a topic is deleted with its owner's account", async () => {
			await base.$executeRaw`delete from auth.users where id = ${alex}::uuid`
			assert.equal(await topics.find(alex, TOPIC.youtubeId), null)
		})
	}
)
