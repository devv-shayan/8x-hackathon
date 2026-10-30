import type { PrismaClient } from '@prisma/client'
import { db } from './client'

// What the marketing site collects before anyone has an account
// (prisma/schema/leads.prisma): the waitlist, and messages from the support form and the
// public account-deletion page. Written by those forms' API routes, counted by the admin
// panel.

export type NewContactMessage = {
	name: string
	email: string
	message: string
	/** 'general' | 'deletion' | … */
	category: string
}

export function createLeadStore(client: PrismaClient) {
	return {
		/**
		 * Adds the address to the waitlist. Joining twice is not an error and changes nothing:
		 * the first row, its source and its date, stand.
		 */
		async joinWaitlist(entry: {
			email: string
			source: string
			userAgent: string | null
		}): Promise<void> {
			await client.waitlistEntry.createMany({ data: [entry], skipDuplicates: true })
		},

		async addContactMessage(message: NewContactMessage): Promise<void> {
			await client.contactMessage.create({ data: message })
		},

		/** The admin overview's headline counts. */
		async counts(): Promise<{ waitlist: number; contactMessages: number }> {
			const [waitlist, contactMessages] = await Promise.all([
				client.waitlistEntry.count(),
				client.contactMessage.count()
			])
			return { waitlist, contactMessages }
		}
	}
}

export type LeadStore = ReturnType<typeof createLeadStore>

export const leadStore = createLeadStore(db)
