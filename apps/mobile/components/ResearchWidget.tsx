import { EightxResearch } from '@8xresearch/research-widget'
import { usePathname } from 'expo-router'
import { useTabBarTop } from '@/components/TabBar'
import { track } from '@/lib/analytics'
import { env } from '@/lib/env'

/**
 * 8xResearch's in-app interviews: a small pill that opens a voice or typed
 * interview over the app, run by 8xResearch.
 *
 * Off unless EXPO_PUBLIC_RESEARCH_PRODUCT_KEY is set (lib/env.ts). With a key,
 * the package asks 8xResearch on every launch what this product offers, and the
 * pill shows only while a study is live for it. No live study, an unreadable
 * answer or a refused microphone all show nothing, and the app is untouched.
 * Studies are published, paused and scheduled in 8xResearch, so a new one reaches
 * installed apps with no release. The package also hides a study for good once
 * this device finishes it, for three days after "ask me later", and for good
 * after "don't ask again".
 *
 * Mounted once in app/_layout.tsx, beside the navigator, so an interview keeps
 * running while the person moves between screens, and only for people who are
 * signed in and onboarded (`visible`). The launcher clears the tab bar through
 * `bottomInset`, never a shorter wrapper: a wrapper also becomes the interview
 * sheet's box, and the sheet then cannot take itself off screen.
 *
 * Hidden on the paywall (PAYWALL_PATH): its bottom shelf is taller than the tab
 * bar the pill clears, so the pill would sit on the Continue button and the
 * price line App Review checks. Leaving the paywall shows it again.
 */
export const PAYWALL_PATH = '/upgrade'

export default function ResearchWidget({ visible }: { visible: boolean }) {
	const tabBarTop = useTabBarTop()
	const pathname = usePathname()
	const productKey = env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
	if (!productKey || !visible || pathname === PAYWALL_PATH) return null
	return (
		<EightxResearch
			productKey={productKey}
			bottomInset={tabBarTop}
			onStart={() => track('research_interview_started')}
			onComplete={() => track('research_interview_completed')}
			onFailure={({ reason }) =>
				track('research_interview_failed', { reason: reason ?? 'unknown' })
			}
			onClose={() => track('research_interview_closed')}
		/>
	)
}
