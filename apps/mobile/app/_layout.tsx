import React, { useEffect, useMemo, useState } from 'react'
import { View, Platform, DeviceEventEmitter } from 'react-native'
import { Stack, useNavigationContainerRef, usePathname } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { palette, type Palette } from '@app/brand'
import { queryClient } from '@/lib/queryClient'
import { presetFonts } from '@/lib/fonts'
import { loadThemePref } from '@/lib/themePref'
import { loadHapticsPref } from '@/lib/haptics'
import { makeStyles } from '@/lib/themedStyles'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import * as Sentry from '@sentry/react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
	ThemeProvider as NavigationThemeProvider,
	DarkTheme,
	DefaultTheme,
	type Theme as NavigationTheme
} from '@react-navigation/native'
import { PostHogProvider } from 'posthog-react-native'
import { I18nextProvider } from 'react-i18next'

import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import { posthog, isPostHogEnabled, identify, resetIdentity, track } from '@/lib/analytics'
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '@/lib/purchases'
import { announceSession } from '@/lib/lifecycle'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { ToastProvider, useToast } from '@/contexts/ToastContext'
import { onSessionExpired } from '@/lib/api'
import i18n, { initI18n } from '@/lib/i18n'
import OfflineBanner from '@/components/OfflineBanner'
import OfflineOverlay from '@/components/OfflineOverlay'
import UpdateRequiredGate from '@/components/UpdateRequiredGate'
import ResearchWidget from '@/components/ResearchWidget'
import { Text } from '@/components/ui/Text'
import { env } from '@/lib/env'
import { log } from '@/lib/logger'

// Hold the native splash until fonts, the theme preference, i18n and the
// session are known — the first frame the user sees is the finished one.
SplashScreen.preventAutoHideAsync().catch(() => {})

// ES modules evaluate every import before this line runs, wherever the imports
// are written, so listing them first changes nothing about when Sentry starts.
const routingInstrumentation = Sentry.reactNavigationIntegration()

Sentry.init({
	dsn: env.EXPO_PUBLIC_SENTRY_DSN ?? '',
	environment: __DEV__ ? 'development' : 'production',
	enabled: !__DEV__ && !!env.EXPO_PUBLIC_SENTRY_DSN,
	integrations: [routingInstrumentation],
	tracesSampleRate: 0
})

// ─── Error boundary ───────────────────────────────────────────────────────────
// React requires a class component to catch render errors — hooks cannot do this.

function ErrorFallback() {
	const eb = useErrorStyles()
	return (
		<View style={eb.container}>
			<Text style={eb.title}>Something went wrong</Text>
			<Text style={eb.subtitle}>Please close and reopen the app.</Text>
		</View>
	)
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
	state = { hasError: false }

	static getDerivedStateFromError() {
		return { hasError: true }
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		// The console in development; in a release build the logger captures the
		// exception in Sentry with the component stack, as this did directly before.
		log.error('Uncaught render error', { error, componentStack: info.componentStack })
	}

	render() {
		if (this.state.hasError) return <ErrorFallback />
		return this.props.children
	}
}

const useErrorStyles = makeStyles((c) => ({
	container: {
		flex: 1,
		backgroundColor: c.bg,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32
	},
	title: {
		color: c.textPrimary,
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 10,
		textAlign: 'center'
	},
	subtitle: { color: c.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 }
}))

// ─── Theme ────────────────────────────────────────────────────────────────────
// React Navigation draws some chrome itself (card backgrounds during
// transitions, default headers); give it the palette so nothing flashes a
// stock white or black between screens.

const navigationThemes = new Map<Palette, NavigationTheme>()

function navigationTheme(c: Palette): NavigationTheme {
	let t = navigationThemes.get(c)
	if (!t) {
		const base = c.scheme === 'dark' ? DarkTheme : DefaultTheme
		t = {
			...base,
			dark: c.scheme === 'dark',
			colors: {
				...base.colors,
				primary: c.brandInk,
				background: c.bg,
				card: c.surface,
				text: c.textPrimary,
				border: c.borderSoft,
				notification: c.error
			}
		}
		navigationThemes.set(c, t)
	}
	return t
}

// ─── Transitions ──────────────────────────────────────────────────────────────
// A pushed screen slides in from the side (the system's own gesture-driven
// transition, so the back swipe tracks the finger); the paywall rises from the
// bottom as a modal.

const PUSH = { animation: 'slide_from_right' } as const
const MODAL = { animation: 'slide_from_bottom', gestureEnabled: true } as const

// ─── Conditional PostHog provider ─────────────────────────────────────────────
// PostHogProvider requires a valid client instance. When the API key is missing
// we skip the provider entirely so no errors are thrown.

function MaybePostHogProvider({ children }: { children: React.ReactNode }) {
	if (isPostHogEnabled && posthog) {
		return <PostHogProvider client={posthog}>{children}</PostHogProvider>
	}
	return <>{children}</>
}

// ─── Session expiry ──────────────────────────────────────────────────────────
// When the server refuses a session for good, lib/api.ts signs this device out
// (the auth listener below routes to the signed-out screens). This says why,
// once, instead of the app simply dropping the person at the welcome screen.

function SessionExpiredNotice() {
	const { showToast } = useToast()
	useEffect(
		() => onSessionExpired(() => showToast('Your session has expired. Sign in again.', 'info')),
		[showToast]
	)
	return null
}

// ─── Screen tracking ─────────────────────────────────────────────────────────
// Rendered inside the navigator so usePathname has routing context.

function ScreenTracker() {
	const pathname = usePathname()
	useEffect(() => {
		track('screen_viewed', { screen: pathname })
	}, [pathname])
	return null
}

// ─── Root layout ──────────────────────────────────────────────────────────────

function RootLayout() {
	const navigationRef = useNavigationContainerRef()
	// Only the active preset's faces (lib/fonts.ts). A font that fails to load
	// must not strand the user on the splash: fall through to system type.
	const [fontsLoaded, fontError] = useFonts(presetFonts)
	const [themeReady, setThemeReady] = useState(false)

	// null = still checking; true/false = auth state known
	const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
	// null = loading; false = not completed; true = completed
	const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)
	const [i18nReady, setI18nReady] = useState(false)

	useEffect(() => {
		initI18n().then(() => setI18nReady(true))
	}, [])

	// Read the stored light/dark choice (and the haptics switch) before first
	// paint, so the first frame is already in the right scheme.
	useEffect(() => {
		Promise.all([loadThemePref(), loadHapticsPref()]).finally(() => setThemeReady(true))
	}, [])

	useEffect(() => {
		if (navigationRef.current) {
			routingInstrumentation.registerNavigationContainer(navigationRef)
		}
	}, [navigationRef])

	useEffect(() => {
		// Configure RevenueCat once at startup, before any user is known
		configureRevenueCat()

		if (!isSupabaseEnabled) {
			// No credentials — stay on landing page, no errors thrown
			setIsAuthed(false)
			return
		}

		supabase.auth
			.getSession()
			.then(({ data: { session } }) => {
				setIsAuthed(!!session)
				if (session?.user) {
					setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
					loginRevenueCat(session.user.id)
					identify(session.user.id, session.user.email ? { email: session.user.email } : undefined)
					// Emits user_signed_up and stamps last_seen_at / region server-side.
					// Idempotent, so calling it on every cold start is correct.
					void announceSession()
				} else {
					setOnboardingCompleted(null)
				}
			})
			.catch((error: unknown) => {
				log.warn('Could not reach Supabase; defaulting to signed-out', { error })
				setIsAuthed(false)
			})

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_IN' && session?.user) {
				setIsAuthed(true)
				setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
				loginRevenueCat(session.user.id)
				identify(session.user.id, session.user.email ? { email: session.user.email } : undefined)
				void announceSession()
			}
			if (event === 'SIGNED_OUT') {
				setIsAuthed(false)
				setOnboardingCompleted(null)
				logoutRevenueCat()
				resetIdentity()
				// Nothing one person loaded may show to the next one who signs in.
				queryClient.clear()
			}
			if (event === 'USER_UPDATED' && session?.user) {
				setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
			}
			if (event === 'TOKEN_REFRESHED' && session?.user) {
				setOnboardingCompleted(session.user.user_metadata?.onboarding_completed === true)
			}
		})

		return () => subscription.unsubscribe()
	}, [])

	// Development only: the login screen's "Skip" buttons land in the app (or in
	// onboarding) without a backend, so every screen can be built and reviewed.
	useEffect(() => {
		if (!__DEV__) return
		const sub = DeviceEventEmitter.addListener(
			'__dev_skip_auth__',
			(payload?: { onboarding?: boolean }) => {
				setIsAuthed(true)
				setOnboardingCompleted(!payload?.onboarding)
			}
		)
		return () => sub.remove()
	}, [])

	const ready =
		(fontsLoaded || !!fontError) &&
		themeReady &&
		isAuthed !== null &&
		i18nReady &&
		!(isAuthed === true && onboardingCompleted === null)

	useEffect(() => {
		if (ready) SplashScreen.hideAsync().catch(() => {})
	}, [ready])

	// The splash covers this; the ground colour is a fallback if it could not be held.
	// It prevents a flash of wrong content on launch.
	if (!ready) {
		return <View style={{ flex: 1, backgroundColor: palette().bg }} />
	}

	return (
		<ThemeProvider>
			<AppTree
				navigationRef={navigationRef}
				isAuthed={!!isAuthed}
				onboardingCompleted={onboardingCompleted}
			/>
		</ThemeProvider>
	)
}

// ─── App tree ─────────────────────────────────────────────────────────────────
// Inside the ThemeProvider, so every colour here follows the active scheme.

function AppTree({
	navigationRef,
	isAuthed,
	onboardingCompleted
}: {
	navigationRef: ReturnType<typeof useNavigationContainerRef>
	isAuthed: boolean
	onboardingCompleted: boolean | null
}) {
	const { colors } = useTheme()
	const navTheme = useMemo(() => navigationTheme(colors), [colors])

	return (
		<SafeAreaProvider>
			<ErrorBoundary>
				<I18nextProvider i18n={i18n}>
					<MaybePostHogProvider>
						<QueryClientProvider client={queryClient}>
							<SubscriptionProvider>
								<GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
									<ToastProvider>
										<StatusBar
											style={colors.statusBarStyle}
											translucent={Platform.OS === 'android'}
											backgroundColor={Platform.OS === 'android' ? colors.bg : undefined}
										/>
										<NavigationThemeProvider value={navTheme}>
											<View style={{ flex: 1, backgroundColor: colors.bg }}>
												<Stack
													ref={navigationRef}
													screenOptions={{
														headerShown: false,
														// Switching between the signed-out, onboarding and signed-in
														// worlds cross-fades; pushed screens slide (below).
														animation: 'fade',
														contentStyle: { backgroundColor: colors.bg }
													}}
												>
													{/* ── Unauthenticated screens ──────────────────────────────────
                        Accessible only when signed out. When isAuthed flips to true,
                        Stack.Protected removes these and Expo Router auto-redirects to
                        the first accessible authenticated screen. */}
													<Stack.Protected guard={!isAuthed}>
														<Stack.Screen name="index" />
														<Stack.Screen name="(auth)" options={PUSH} />
													</Stack.Protected>

													{/* ── Onboarding screens ───────────────────────────────────────
                        Shown when signed in but onboarding not yet completed. */}
													<Stack.Protected guard={isAuthed && onboardingCompleted === false}>
														<Stack.Screen name="(onboarding)" />
													</Stack.Protected>

													{/* ── Authenticated screens ────────────────────────────────────
                        Accessible only when signed in + onboarding done. */}
													<Stack.Protected guard={isAuthed && onboardingCompleted === true}>
														<Stack.Screen name="(tabs)" />
														<Stack.Screen name="detail/[id]" options={PUSH} />
														<Stack.Screen name="class/[topicId]" options={PUSH} />
														<Stack.Screen name="settings" options={PUSH} />
														<Stack.Screen name="support" options={PUSH} />
													</Stack.Protected>

													{/* ── Always-public screens — declared LAST so they don't become
                        the default redirect target when a protected group flips. ── */}
													<Stack.Screen name="upgrade" options={MODAL} />
													<Stack.Screen name="privacy" options={PUSH} />
													<Stack.Screen name="terms" options={PUSH} />
												</Stack>
												<ScreenTracker />
												<SessionExpiredNotice />
												{/* 8xResearch interviews, off without a product key. Beside the
                        navigator so an interview survives moving between screens;
                        signed-in, onboarded people only. */}
												<ResearchWidget visible={isAuthed && onboardingCompleted === true} />
												<OfflineBanner />
												<OfflineOverlay />
												<UpdateRequiredGate />
											</View>
										</NavigationThemeProvider>
									</ToastProvider>
								</GestureHandlerRootView>
							</SubscriptionProvider>
						</QueryClientProvider>
					</MaybePostHogProvider>
				</I18nextProvider>
			</ErrorBoundary>
		</SafeAreaProvider>
	)
}

export default Sentry.wrap(RootLayout)
