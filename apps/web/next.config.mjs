import { assertProductionBuildEnv, assertProductionDatabaseEnv } from './deploy-checks.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// The shared packages ship raw .ts — let Next transpile them.
	transpilePackages: ['@app/brand', '@app/contract'],
	// Lint is its own gate (`npm run lint`, from the monorepo root config).
	// `next build` would lint a second time, and its plugin check can't see a
	// root config, so it warns that the Next plugin is missing when it isn't.
	// Next 16 drops build-time lint entirely.
	eslint: { ignoreDuringBuilds: true },
	// The app running in a browser (`expo start --web`) is another origin. Local only: a
	// phone isn't a browser, and nothing in production needs this.
	async headers() {
		if (process.env.NODE_ENV !== 'development') return []
		return [
			{
				source: '/api/app/v1/:path*',
				headers: [
					{ key: 'Access-Control-Allow-Origin', value: 'http://localhost:8081' },
					{ key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
					{ key: 'Access-Control-Allow-Headers', value: 'Authorization,Content-Type' }
				]
			}
		]
	},
	async redirects() {
		return [
			// www → apex. Replace example.com with your domain.
			{
				source: '/:path*',
				has: [{ type: 'host', value: 'www.example.com' }],
				destination: 'https://example.com/:path*',
				permanent: true
			}
		]
	}
}

/**
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
export default function config(phase) {
	// `next build` only (next/constants' PHASE_PRODUCTION_BUILD). It fails only a
	// Vercel production build missing what production needs: deploy-checks.mjs.
	if (phase === 'phase-production-build') {
		assertProductionBuildEnv(process.env)
		assertProductionDatabaseEnv(process.env)
	}
	return nextConfig
}
