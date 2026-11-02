import type { Metadata, Viewport } from 'next'
import {
	Bricolage_Grotesque,
	Inter,
	Inter_Tight,
	JetBrains_Mono,
	Source_Serif_4
} from 'next/font/google'
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { brandConfig, brandCss, palette, theme } from '@app/brand'
import { PostHogProvider } from '@/components/PostHogProvider'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import './globals.css'
import '@/components/landing/landing.css'

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

// The website's own faces (src/components/landing/landing.css): Inter Tight for text and
// headlines, JetBrains Mono for the small uppercase labels.
const interTight = Inter_Tight({
	subsets: ['latin'],
	variable: '--font-inter-tight',
	display: 'swap'
})

const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-jetbrains',
	display: 'swap'
})

// Every colour, radius, shadow and easing as CSS variables, generated from the
// same TS source the mobile app reads — no second copy to drift.
const BRAND_CSS = brandCss(theme)

// The website is light, whatever the app's own opening scheme: the brand's light
// scheme for shared components, under the website's white and lime.
const WEB_SCHEME = 'light'

const SITE_NAME = brandConfig.siteName

// The marketing site's design contract (impeccable), emitted as the body's
// first child so it survives the build and anyone can read it in view-source.
// React cannot emit a bare comment, so it rides inside an inert, hidden div.
const DIRECTION_CONTRACT = `<!--
THESIS: White paper, black ink, one lime highlight. The first viewport is the class itself: Maya and Omar drawn live in pixels, raising a hand when called on.
WORLD: Inter Tight headlines tracked tight, JetBrains Mono labels in caps, hairline rules around every grid, square buttons that open with ">". Each product section sits on its own generated, dithered background (drawn by @app/pixel in packages/pixel): voice waves, gold drift, warm-up ripples, a lime tunnel, lime edges.
STORY: Meet the class; how it works; explain, teach, see what stuck; why gaps come back; why teaching works; the students; questions; start a class.
MOTION: Every background is generated, pauses off screen, and holds one still frame for reduced motion.
-->`

// Replace with your real domain. Falls back to NEXT_PUBLIC_SITE_URL in env.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: `${SITE_NAME} — Teach it. The class talks back.`,
		template: `%s · ${SITE_NAME}`
	},
	description:
		'Paste a YouTube video, explain it, and teach AI students who ask about what you missed, so it sticks.',
	openGraph: {
		title: `${SITE_NAME} — Teach it. The class talks back.`,
		description:
			'Paste a YouTube video, explain it, and teach AI students who ask about what you missed.',
		url: SITE_URL,
		siteName: SITE_NAME,
		locale: 'en_US',
		type: 'website'
	},
	twitter: {
		card: 'summary_large_image',
		title: SITE_NAME,
		description:
			'Paste a YouTube video, explain it, and teach AI students who ask about what you missed.'
	}
	// The favicon is app/icon.tsx, drawn from the brand — no need to declare it.
}

export const viewport: Viewport = {
	themeColor: palette(WEB_SCHEME).bg,
	colorScheme: WEB_SCHEME,
	width: 'device-width',
	initialScale: 1
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en"
			data-preset={theme.preset}
			data-scheme={WEB_SCHEME}
			className={`${inter.variable} ${sourceSerif.variable} ${bricolage.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
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
