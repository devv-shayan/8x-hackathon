/**
 * Onboarding — runs once, after the first sign-in.
 *
 * Two steps in one shell: a name (optional, skippable) and the appearance
 * (applied live, so the choice is its own preview). Completing saves the name
 * to the profile through the API (PATCH /api/app/v1/profile), then writes
 * `onboarding_completed` to the user's metadata; the auth listener in
 * app/_layout.tsx then routes to the tabs.
 *
 * To add a step: add it to STEPS, render it in the step switch below, and give
 * its CTA a `refusal` if it can't be continued unanswered. Its
 * onboarding_step_viewed event fires by itself.
 */
import { useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { DISPLAY_NAME_MAX } from '@app/contract'
import Animated, { FadeInLeft, FadeInRight, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { Moon, Sun, SunMoon } from 'lucide-react-native'
import { OnboardingShell } from '@/components/onboarding/Shell'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { SelectionRow } from '@/components/ui/SelectionRow'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme, type ThemePref } from '@/contexts/ThemeContext'
import { toUserProfile } from '@/hooks/useProfile'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { Durations, Easings } from '@/lib/motion'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

const STEPS = ['name', 'appearance'] as const
type Step = (typeof STEPS)[number]

const forward = FadeInRight.duration(Durations.enter)
	.easing(Easings.out)
	.reduceMotion(ReduceMotion.System)
const backward = FadeInLeft.duration(Durations.enter)
	.easing(Easings.out)
	.reduceMotion(ReduceMotion.System)
const leave = FadeOut.duration(Durations.exit).reduceMotion(ReduceMotion.System)

const APPEARANCE: { value: ThemePref; title: string; subtitle: string; icon: typeof Sun }[] = [
	{
		value: 'system',
		title: 'Match my phone',
		subtitle: 'Follows your system setting',
		icon: SunMoon
	},
	{ value: 'light', title: 'Light', subtitle: 'Bright surfaces, dark text', icon: Sun },
	{ value: 'dark', title: 'Dark', subtitle: 'Easy on the eyes at night', icon: Moon }
]

export default function OnboardingScreen() {
	const { pref, setPref, colors: c } = useTheme()
	const queryClient = useQueryClient()
	const [index, setIndex] = useState(0)
	const [direction, setDirection] = useState<1 | -1>(1)
	const [name, setName] = useState('')
	const [skippedName, setSkippedName] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const started = useRef(false)
	const step: Step = STEPS[index] ?? 'name'

	useEffect(() => {
		if (started.current) return
		started.current = true
		track('onboarding_started')
	}, [])

	useEffect(() => {
		track('onboarding_step_viewed', { step, index })
	}, [step, index])

	function go(next: number) {
		setDirection(next > index ? 1 : -1)
		setIndex(next)
		setError(null)
	}

	function chooseAppearance(mode: ThemePref) {
		if (mode === pref) return
		setPref(mode)
		track('appearance_changed', { mode, source: 'onboarding' })
	}

	async function complete() {
		setSaving(true)
		setError(null)
		const fullName = skippedName ? undefined : name.trim() || undefined

		// Development without a backend: finish locally so the app can be reviewed.
		if (__DEV__ && !isSupabaseEnabled) {
			track('onboarding_completed', { skipped_name: !fullName, appearance: pref })
			DeviceEventEmitter.emit('__dev_skip_auth__')
			return
		}

		// The name first: if it can't be saved, onboarding isn't finished, and the
		// person sees why (the API's message) and can try again. The route makes
		// the profile row if the signup trigger never did.
		if (fullName) {
			try {
				const { profile } = await api('updateProfile', { body: { display_name: fullName } })
				queryClient.setQueryData(['profile'], toUserProfile(profile))
			} catch (e) {
				setSaving(false)
				haptic.error()
				setError(errorMessage(e))
				return
			}
		}

		const { error: err } = await supabase.auth.updateUser({
			data: { onboarding_completed: true, full_name: fullName }
		})
		if (err) {
			setSaving(false)
			haptic.error()
			setError("We couldn't save that. Check your connection and try again.")
			return
		}

		haptic.success()
		track('onboarding_completed', { skipped_name: !fullName, appearance: pref })
		setSaving(false)
		// app/_layout.tsx sees onboarding_completed and routes to (tabs).
	}

	const cta =
		step === 'name'
			? {
					label: 'Continue',
					onPress: () => {
						setSkippedName(false)
						go(index + 1)
					},
					refusal: name.trim() ? null : 'Type a name, or tap Skip.'
				}
			: { label: 'Finish', onPress: complete, loading: saving }

	return (
		<OnboardingShell
			step={index}
			total={STEPS.length}
			onBack={index > 0 ? () => go(index - 1) : undefined}
			onSkip={
				step === 'name'
					? () => {
							setSkippedName(true)
							go(index + 1)
						}
					: undefined
			}
			cta={cta}
		>
			<Animated.View
				key={step}
				entering={direction === 1 ? forward : backward}
				exiting={leave}
				style={s.step}
			>
				<Eyebrow>{`Step ${index + 1} of ${STEPS.length}`}</Eyebrow>

				{step === 'name' ? (
					<>
						<View style={s.titles}>
							<Text variant="question" accessibilityRole="header">
								What should we call you?
							</Text>
							<Text variant="body" tone="secondary">
								It&apos;s how the app greets you. Change it any time in your profile.
							</Text>
						</View>
						<TextInputField
							value={name}
							onChangeText={setName}
							placeholder="Your first name"
							accessibilityLabel="Your name"
							textContentType="givenName"
							autoComplete="given-name"
							autoCapitalize="words"
							maxLength={DISPLAY_NAME_MAX}
							returnKeyType="next"
							onSubmitEditing={() => name.trim() && go(index + 1)}
							autoFocus
						/>
					</>
				) : (
					<>
						<View style={s.titles}>
							<Text variant="question" accessibilityRole="header">
								Light, dark, or match your phone?
							</Text>
							<Text variant="body" tone="secondary">
								The app changes as you choose. You can switch any time in Settings.
							</Text>
						</View>
						<View style={s.options} accessibilityRole="radiogroup">
							{APPEARANCE.map((o) => {
								const Icon = o.icon
								const selected = pref === o.value
								return (
									<SelectionRow
										key={o.value}
										title={o.title}
										subtitle={o.subtitle}
										selected={selected}
										onPress={() => chooseAppearance(o.value)}
										leading={
											<View
												style={[s.icon, { backgroundColor: selected ? c.surface : c.surface3 }]}
											>
												<Icon
													size={18}
													color={selected ? c.brandInk : c.textSecondary}
													strokeWidth={2}
												/>
											</View>
										}
									/>
								)
							})}
						</View>
						{error ? (
							<Text variant="bodySm" tone="error" accessibilityLiveRegion="polite">
								{error}
							</Text>
						) : null}
					</>
				)}
			</Animated.View>
		</OnboardingShell>
	)
}

const s = StyleSheet.create({
	step: { gap: 22 },
	titles: { gap: 10 },
	options: { gap: 10 },
	icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
})
