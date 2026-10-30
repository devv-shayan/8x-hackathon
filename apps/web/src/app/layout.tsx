import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter, Source_Serif_4 } from 'next/font/google'
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { brandConfig, brandCss, palette, theme } from '@app/brand'
import { PostHogProvider } from '@/components/PostHogProvider'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import './globals.css'

// Fonts. Inter is the text face for both presets; the display face is picked
// by the preset through --font-display (packages/brand/src/css.ts): Source
// Serif 4 for dusk, Bricolage Grotesque for daylight. Both are declared so a
// preset switch is one line in brand.config.ts; neither display face is
// preloaded, so the one the preset does not use is never downloaded.
const inter = Inter({
	subsets: ['latin'],
	variable: '--font-inter',
	display: 'swap'
})

const sourceSerif = Source_Serif_4({
	subsets: ['latin'],
	variable: '--font-source-serif',
	display: 'swap',
	axes: ['opsz'],
	preload: false
})

const bricolage = Bricolage_Grotesque({
	subsets: ['latin'],
	variable: '--font-bricolage',
	display: 'swap',
	axes: ['opsz'],
	preload: false
})

// Every colour, radius, shadow and easing as CSS variables, generated from the
// same TS source the mobile app reads — no second copy to drift.
const BRAND_CSS = brandCss(theme)

const SITE_NAME = brandConfig.siteName

// The marketing site's design contract (impeccable), emitted as the body's
// first child so it survives the build and anyone can read it in view-source.
// React cannot emit a bare comment, so it rides inside an inert, hidden div.
const DIRECTION_CONTRACT = `<!--
THESIS: The first viewport is the product: the app's home screen, drawn from brand tokens on a real-proportion phone beside the headline and store buttons. Refuses a centred headline over a screenshot slot.
OWN-WORLD: One structure, two worlds. dusk: midnight ladder, Source Serif 4 at 600, film grain, blur dissolves; the accent as glow for atmosphere, as ink for interactive text and the one primary fill. daylight: stone paper, Bricolage Grotesque 800 tracked tight, marigold fields under graphite ink, crisp rises. Ink store pills, glass capsule nav.
STORY: See the app work; watch four acts dealt onto one pinned phone; see features shown, not claimed; tap a store or join the waitlist.
FIRST VIEWPORT: Capsule nav above. Left 55%: word-rise headline to 6rem, promise, store buttons above the fold at 1440x900 and 390x844. Right: 320pt phone on its glow or field.
FORM: brief-pinned to the two presets PRODUCT.md names; no roll, no seed.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`

// Replace with your real domain. Falls back to NEXT_PUBLIC_SITE_URL in env.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: `${SITE_NAME} — your one-line pitch goes here`,
		template: `%s · ${SITE_NAME}`
	},
	description:
		'Replace this with your product description. This is the app monorepo template: an Expo mobile app + this Next.js marketing site, sharing one brand and one Supabase backend.',
	openGraph: {
		title: `${SITE_NAME} — your one-line pitch goes here`,
		description: 'Replace this with your product description.',
		url: SITE_URL,
		siteName: SITE_NAME,
		locale: 'en_US',
		type: 'website'
	},
	twitter: {
		card: 'summary_large_image',
		title: SITE_NAME,
		description: 'Replace this with your product description.'
	}
	// The favicon is app/icon.tsx, drawn from the brand — no need to declare it.
}

export const viewport: Viewport = {
	themeColor: palette().bg,
	colorScheme: theme.primaryScheme,
	width: 'device-width',
	initialScale: 1
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en"
			data-preset={theme.preset}
			data-scheme={theme.primaryScheme}
			className={`${inter.variable} ${sourceSerif.variable} ${bricolage.variable}`}
		>
			<head>
				<style id="brand-tokens" dangerouslySetInnerHTML={{ __html: BRAND_CSS }} />
			</head>
			<body>
				<div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
				<Suspense fallback={null}>
					<PostHogProvider>{children}</PostHogProvider>
					<GoogleAnalytics />
				</Suspense>
				<Analytics />
			</body>
		</html>
	)
}
