import { readFileSync, writeFileSync, existsSync } from 'node:fs'

function parse(text) {
	const out = {}
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const index = trimmed.indexOf('=')
		if (index < 0) continue
		let value = trimmed.slice(index + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		out[trimmed.slice(0, index).trim()] = value
	}
	return out
}

const example = readFileSync('apps/web/.env.example', 'utf8').replace(/\r\n/g, '\n')
const old = existsSync('.env') ? parse(readFileSync('.env', 'utf8')) : {}
const keys = [
	'DATABASE_URL',
	'DIRECT_URL',
	'NEXT_PUBLIC_SUPABASE_URL',
	'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
	'SUPABASE_SECRET_KEY',
	'GEMINI_API_KEY',
	'SUPADATA_API_KEY',
	'GOOGLE_API_KEY',
	'NEXT_PUBLIC_POSTHOG_KEY',
	'NEXT_PUBLIC_POSTHOG_HOST',
	'CRON_SECRET',
	'NEXT_PUBLIC_SITE_URL'
]
const overlay = {}
for (const key of keys) {
	if (old[key]) overlay[key] = old[key]
}
const seen = new Set()
const lines = example.split('\n').map((line) => {
	const match = line.match(/^([A-Z0-9_]+)=/)
	if (!match || overlay[match[1]] == null) return line
	seen.add(match[1])
	return `${match[1]}=${JSON.stringify(overlay[match[1]])}`
})
for (const [key, value] of Object.entries(overlay)) {
	if (!seen.has(key)) lines.push(`${key}=${JSON.stringify(value)}`)
}
writeFileSync('apps/web/.env.local', `${lines.join('\n')}\n`)
console.log(`wrote apps/web/.env.local (${Object.keys(overlay).length} values from root .env)`)
