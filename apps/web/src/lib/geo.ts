import { headers } from 'next/headers'

/**
 * The visitor's country (ISO 3166-1 alpha-2), from the edge.
 *
 * Every major host puts this on a request header. We read the common ones in
 * order rather than binding to one platform, so a play that moves from Vercel to
 * Cloudflare doesn't silently lose every country tag.
 *
 * Returns null when it cannot be resolved (local dev, an unrecognised edge).
 * Callers must treat null as "unknown" and omit the field rather than guessing —
 * a wrong country is worse than an absent one, because the dashboard folds
 * unknowns into an honest "unattributed" bucket.
 */
const HEADERS = [
	'x-vercel-ip-country', // Vercel
	'cf-ipcountry', // Cloudflare
	'x-nf-client-connection-ip-country', // Netlify
	'fastly-client-country-code', // Fastly
	'x-geo-country' // generic / custom proxies
]

export async function getRequestCountry(): Promise<string | null> {
	// Local override so the non-default market paths can be exercised without a VPN.
	const dev = process.env.NEXT_PUBLIC_DEV_COUNTRY
	if (dev && process.env.NODE_ENV !== 'production') return normalize(dev)

	try {
		const h = await headers()
		for (const name of HEADERS) {
			const value = normalize(h.get(name))
			if (value) return value
		}
	} catch {
		// headers() throws outside a request scope (e.g. during build).
	}
	return null
}

/** ISO alpha-2 or nothing. Anything else folds into the unattributed remainder
 *  rather than being guessed at. */
function normalize(raw: string | null | undefined): string | null {
	const v = (raw ?? '').trim().toUpperCase()
	if (!/^[A-Z]{2}$/.test(v)) return null
	// Some edges use XX / T1 (Tor) as a placeholder for "unknown".
	if (v === 'XX' || v === 'T1') return null
	return v
}
