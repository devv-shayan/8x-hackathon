// Next.js calls register() once per server instance, before it serves a
// request.
//
// With the src/ layout this file must sit here, beside app/. `next build`
// looks for it only in the directory that holds app/
// (node_modules/next/dist/build/index.js, Next 15.5). `next dev` also
// accepts apps/web/instrumentation.ts, so a copy there works locally and is
// silently skipped in every production build.
export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		// Validates every env var declared in src/lib/env.ts and throws with a
		// clear message if one is malformed, so a misconfigured deployment fails
		// at boot instead of surfacing as an obscure runtime error three
		// requests later.
		await import('./lib/env')
	}
}
