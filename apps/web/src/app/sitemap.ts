import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

export default function sitemap(): MetadataRoute.Sitemap {
	const routes = ['', '/pricing', '/support', '/privacy', '/terms', '/delete-account']
	return routes.map((path) => ({
		url: `${SITE_URL}${path}`,
		changeFrequency: 'monthly',
		priority: path === '' ? 1 : 0.6
	}))
}
