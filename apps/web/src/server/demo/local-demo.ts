import { randomUUID } from 'node:crypto'
import type { ConceptResult } from '@/server/classroom/score-explanation'
import type { TopicRecord } from '@/server/db/topics'
import type { KeyConcept } from '@/server/video/key-concepts'
import type { TranscriptSegment } from '@/server/video/transcript'

/** Bearer token the app sends in development when sign-in is skipped. */
export const LOCAL_DEMO_BEARER = 'local-demo'

export const LOCAL_DEMO_USER = {
	id: '00000000-0000-4000-8000-000000000015',
	email: 'demo.score@chalkback.local',
	fullName: 'Demo Teacher'
} as const

export function isLocalDemoUser(userId: string): boolean {
	return process.env.NODE_ENV !== 'production' && userId === LOCAL_DEMO_USER.id
}

export function isLocalDemoBearer(token: string): boolean {
	return process.env.NODE_ENV !== 'production' && token === LOCAL_DEMO_BEARER
}

type OwnedTopic = TopicRecord & { userId: string; createdAt: Date }

type DemoTurn = {
	id: string
	classId: string
	studentId: string
	question: string
	answer: string | null
	outcome: 'answered' | 'needed_help' | 'skipped' | null
	helpUsedAt: Date | null
	answeredAt: Date | null
	createdAt: Date
}

type DemoReaction = { studentId: string; text: string }

type DemoClass = {
	id: string
	topicId: string
	explanation: string
	conceptResults: ConceptResult[]
	reactions: DemoReaction[] | null
	turns: DemoTurn[]
	createdAt: Date
}

type DemoStudent = {
	id: string
	userId: string
	name: string
	persona: string
	createdAt: Date
}

type DemoGlobals = {
	__chalkbackDemoTopics?: Map<string, OwnedTopic>
	__chalkbackDemoClasses?: Map<string, DemoClass>
	__chalkbackDemoStudents?: Map<string, DemoStudent[]>
}

const globals = globalThis as typeof globalThis & DemoGlobals
const topics = (globals.__chalkbackDemoTopics ??= new Map<string, OwnedTopic>())
const classes = (globals.__chalkbackDemoClasses ??= new Map<string, DemoClass>())
const studentsByUser = (globals.__chalkbackDemoStudents ??= new Map<string, DemoStudent[]>())

function cloneClass(row: DemoClass): DemoClass {
	return {
		...row,
		conceptResults: row.conceptResults.map((result) => ({ ...result })),
		reactions: row.reactions?.map((reaction) => ({ ...reaction })) ?? null,
		turns: row.turns.map((turn) => ({ ...turn }))
	}
}

export const demoMemory = {
	hasTopic(topicId: string): boolean {
		return topics.has(topicId)
	},

	hasClass(classId: string): boolean {
		return classes.has(classId)
	},

	findTopic(userId: string, youtubeId: string): TopicRecord | null {
		return (
			[...topics.values()].find(
				(topic) => topic.userId === userId && topic.youtubeId === youtubeId
			) ?? null
		)
	},

	findTopicById(userId: string, id: string): TopicRecord | null {
		const topic = topics.get(id)
		return topic?.userId === userId ? topic : null
	},

	listTopics(userId: string, limit: number): { id: string; youtubeId: string; title: string }[] {
		return [...topics.values()]
			.filter((topic) => topic.userId === userId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.slice(0, limit)
			.map(({ id, youtubeId, title }) => ({ id, youtubeId, title }))
	},

	saveTopic(
		userId: string,
		topic: {
			youtubeId: string
			title: string
			segments: TranscriptSegment[]
			concepts: KeyConcept[]
		}
	): TopicRecord {
		const existing = demoMemory.findTopic(userId, topic.youtubeId)
		if (existing) return existing
		const record: OwnedTopic = { id: randomUUID(), userId, createdAt: new Date(), ...topic }
		topics.set(record.id, record)
		return record
	},

	studentsFor(userId: string, defaults: { name: string; persona: string }[]): DemoStudent[] {
		const existing = studentsByUser.get(userId)
		if (existing && existing.length > 0) return existing
		const created = defaults.map((student) => ({
			id: randomUUID(),
			userId,
			...student,
			createdAt: new Date()
		}))
		studentsByUser.set(userId, created)
		return created
	},

	createClass(topicId: string, explanation: string, conceptResults: ConceptResult[]): DemoClass {
		const row: DemoClass = {
			id: randomUUID(),
			topicId,
			explanation,
			conceptResults: conceptResults.map((result) => ({ ...result })),
			reactions: null,
			turns: [],
			createdAt: new Date()
		}
		classes.set(row.id, row)
		return cloneClass(row)
	},

	saveReactions(classId: string, reactions: DemoReaction[]) {
		const row = classes.get(classId)
		if (row && row.reactions == null) row.reactions = reactions.map((r) => ({ ...r }))
	},

	findClass(userId: string, classId: string): DemoClass | null {
		const row = classes.get(classId)
		if (!row) return null
		const topic = topics.get(row.topicId)
		if (!topic || topic.userId !== userId) return null
		return cloneClass(row)
	},

	findOpenClass(userId: string, topicId: string): DemoClass | null {
		const open = [...classes.values()]
			.filter((row) => {
				if (row.topicId !== topicId) return false
				if (!row.turns.some((turn) => turn.outcome === null)) return false
				return topics.get(row.topicId)?.userId === userId
			})
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
		return open ? cloneClass(open) : null
	},

	addTurn(classId: string, studentId: string, question: string) {
		const row = classes.get(classId)
		if (!row) return
		row.turns.push({
			id: randomUUID(),
			classId,
			studentId,
			question,
			answer: null,
			outcome: null,
			helpUsedAt: null,
			answeredAt: null,
			createdAt: new Date()
		})
	},

	updateQuestion(turnId: string, question: string): boolean {
		for (const row of classes.values()) {
			const turn = row.turns.find((entry) => entry.id === turnId && entry.outcome === null)
			if (turn) {
				turn.question = question
				return true
			}
		}
		return false
	},

	answerTurn(
		classId: string,
		turnId: string,
		answer: { answer: string | null; outcome: 'answered' | 'needed_help' | 'skipped' }
	) {
		const turn = classes
			.get(classId)
			?.turns.find((entry) => entry.id === turnId && entry.outcome === null)
		if (!turn) return false
		turn.answer = answer.answer
		turn.outcome = answer.outcome
		turn.answeredAt = new Date()
		return true
	},

	markHelpUsed(classId: string, turnId: string) {
		const turn = classes
			.get(classId)
			?.turns.find((entry) => entry.id === turnId && entry.outcome === null)
		if (turn) turn.helpUsedAt = new Date()
	},

	dropOpenTurns(classId: string) {
		const row = classes.get(classId)
		if (!row) return
		row.turns = row.turns.filter((turn) => turn.outcome !== null)
	},

	pastTurns() {
		return [] as DemoTurn[]
	}
}
