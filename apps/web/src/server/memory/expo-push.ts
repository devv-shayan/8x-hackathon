// Expo's push service. Expo delivers to Apple and Google. No other vendor.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH = 100

export type ExpoPushMessage = {
	to: string
	title: string
	sound: 'default'
	channelId: string
	data: { path: '/memory'; gap_id: string; stage: string }
}

export type ExpoPushReceipts = {
	/** Tokens Expo accepted. */
	ok: string[]
	/** Tokens Expo says are no longer registered. */
	dead: string[]
}

type Ticket = { status?: string; details?: { error?: string } }

/** Reads Expo's ticket list. A body that is not that list throws: the send did not happen. */
export function readExpoReceipts(body: unknown, tokens: readonly string[]): ExpoPushReceipts {
	if (typeof body !== 'object' || body === null || !('data' in body) || !Array.isArray(body.data)) {
		throw new Error('Expo push replied with an unexpected body')
	}
	if (body.data.length !== tokens.length) {
		throw new Error('Expo push replied with a different number of tickets')
	}
	const ok: string[] = []
	const dead: string[] = []
	body.data.forEach((ticket: Ticket, index) => {
		const token = tokens[index]
		if (!token) return
		if (ticket?.status === 'ok') ok.push(token)
		else if (ticket?.details?.error === 'DeviceNotRegistered') dead.push(token)
	})
	return { ok, dead }
}

/** Sends every message. `fetchImpl` is the tests' stand-in for `fetch`. */
export async function sendExpoPushes(
	messages: readonly ExpoPushMessage[],
	opts: { token: string; fetchImpl?: typeof fetch }
): Promise<ExpoPushReceipts> {
	const fetchImpl = opts.fetchImpl ?? fetch
	const ok: string[] = []
	const dead: string[] = []
	for (let i = 0; i < messages.length; i += BATCH) {
		const batch = messages.slice(i, i + BATCH)
		const response = await fetchImpl(EXPO_PUSH_URL, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				authorization: `Bearer ${opts.token}`
			},
			body: JSON.stringify(batch)
		})
		if (!response.ok) {
			throw new Error(`Expo push answered ${response.status}`)
		}
		const receipts = readExpoReceipts(
			await response.json(),
			batch.map((message) => message.to)
		)
		ok.push(...receipts.ok)
		dead.push(...receipts.dead)
	}
	return { ok, dead }
}
