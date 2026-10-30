import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { TrackInView } from '../TrackInView'
import { Ground } from './Ground'
import { HomeScreen } from '../device/screens/HomeScreen'
import { OnboardingScreen } from '../device/screens/OnboardingScreen'
import { PaywallScreen } from '../device/screens/PaywallScreen'
import { WelcomeScreen } from '../device/screens/WelcomeScreen'
import { SceneScroll, type StoryAct } from './SceneScroll'

// 🎨 REPLACE: your story. Four acts that walk a visitor through the template's
// own screens (welcome, onboarding, home, paywall); keep the ones your app
// has, rewrite the copy, and swap a screen for a real screenshot with
// <DeviceFrame src> when you have one.
const HEADING = 'The whole app, in four acts.'

const ACTS: StoryAct[] = [
	{
		id: 'open',
		label: 'Open it',
		title: 'A welcome that gets out of the way.',
		body: 'One screen says what the app is for, and one tap starts it. No tour, no wall of permissions before you have seen a thing.',
		screen: <WelcomeScreen />,
		screenLabel: "The app's welcome screen",
		light: { x: 72, y: 36, strength: 0.66 }
	},
	{
		id: 'make-it-yours',
		label: 'Make it yours',
		title: 'A few taps, and it fits you.',
		body: 'What to call you, and light or dark: two quick questions, and the app is yours. Skip the one you would rather not answer.',
		screen: <OnboardingScreen />,
		screenLabel: 'The onboarding step that picks light, dark or the phone setting',
		light: { x: 30, y: 62, strength: 0.8 }
	},
	{
		id: 'every-day',
		label: 'Every day',
		title: 'Everything in motion, on one screen.',
		body: 'Open it and the day is waiting: what is moving, how far along it is, and what changed while you were away.',
		screen: <HomeScreen />,
		screenLabel: "The app's home screen, with sample content",
		light: { x: 74, y: 68, strength: 0.9 }
	},
	{
		id: 'go-further',
		label: 'Go further',
		title: 'More when you want it, never before.',
		body: 'Premium is one clear screen: what you get, what it costs and when a trial ends. Restore and cancel are always a tap away.',
		screen: <PaywallScreen />,
		screenLabel: "The app's upgrade screen, with placeholder prices",
		light: { x: 50, y: 28, strength: 1 }
	}
]

export function Story() {
	return (
		<section id="story" className="relative isolate bg-bg">
			<Ground />
			<TrackInView name={FUNNEL_EVENTS.storyView} />
			<SceneScroll heading={HEADING} acts={ACTS} />
		</section>
	)
}
