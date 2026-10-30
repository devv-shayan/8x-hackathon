/**
 * Sign in — a one-time code by email (no password), or a provider.
 *
 * Sign in with Apple is native on iOS (Apple 4.8: an app offering a
 * third-party login offers Apple's own sheet too): expo-apple-authentication
 * presents it and its identity token goes to
 * supabase.auth.signInWithIdToken({ provider: 'apple' }). Everywhere else,
 * Apple and Google go through Supabase OAuth in the browser.
 *
 * 🔑 REPLACE, per play:
 *   1. Supabase → Auth → Providers: enable Apple and Google. For Apple, add
 *      the app's bundle identifier (app.json → ios.bundleIdentifier) to the
 *      provider's Client IDs — that is what the native token is issued for —
 *      and the Services ID, key and team for the web flow.
 *   2. Apple Developer: the App ID gets the Sign in with Apple capability (EAS
 *      Build turns it on from `ios.usesAppleSignIn`).
 *   3. Add the redirect URL `${APP_SCHEME}://auth/callback` in Supabase for
 *      the browser flows.
 *   Remove a provider by deleting its button — but keep Apple while any
 *   other third-party login remains.
 *
 * The auth listener in app/_layout.tsx routes on success; nothing here
 * navigates after signing in. Without Supabase credentials (EXPO_PUBLIC_*),
 * every method says sign-in isn't set up rather than calling a client that has
 * nowhere to go.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	DeviceEventEmitter,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	type TextInput
} from 'react-native'
import Animated, { FadeInRight, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Ionicons } from '@expo/vector-icons'
import { Mail } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { CODE_LENGTH, CodeInput } from '@/components/ui/CodeInput'
import { LogoMark } from '@/components/ui/Marks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { APP_NAME, APP_SCHEME } from '@/lib/constants'
import { haptic } from '@/lib/haptics'
import { Durations, Easings } from '@/lib/motion'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'
import { makeStyles } from '@/lib/themedStyles'

// Required for OAuth session handling on Android
WebBrowser.maybeCompleteAuthSession()

/** Seconds before a code can be sent again. */
const RESEND_COOLDOWN_S = 60
/** Wrong codes allowed before a lockout. */
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

// ─── Disposable email blocklist ───────────────────────────────────────────────
// Prevents throwaway emails from creating accounts.

const DISPOSABLE_DOMAINS = new Set([
	'mailinator.com',
	'guerrillamail.com',
	'10minutemail.com',
	'tempmail.com',
	'temp-mail.org',
	'yopmail.com',
	'trashmail.com',
	'trashmail.me',
	'maildrop.cc',
	'mailnesia.com',
	'discard.email',
	'throwaway.email',
	'getnada.com',
	'fakeinbox.com',
	'getairmail.com',
	'spam4.me',
	'spamgourmet.com',
	'dispostable.com',
	'filzmail.com'
])

function normalizeEmail(raw: string): string {
	const trimmed = raw.trim().toLowerCase()
	const atIdx = trimmed.lastIndexOf('@')
	if (atIdx === -1) return trimmed
	const local = trimmed.slice(0, atIdx)
	const domain = trimmed.slice(atIdx + 1)
	const cleanLocal = local.split('+')[0]
	// Remove dots for Gmail addresses
	const gmailDomains = ['gmail.com', 'googlemail.com']
	const finalLocal = gmailDomains.includes(domain) ? cleanLocal.replace(/\./g, '') : cleanLocal
	return `${finalLocal}@${domain}`
}

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

const stepIn = FadeInRight.duration(Durations.enter)
	.easing(Easings.out)
	.reduceMotion(ReduceMotion.System)
const stepOut = FadeOut.duration(Durations.exit).reduceMotion(ReduceMotion.System)

type Provider = 'google' | 'apple'

/** Provider buttons match the large Button (Apple's button takes an explicit height). */
const PROVIDER_HEIGHT = 56

/** True on iOS 13+ where Apple's native sign-in sheet exists; false elsewhere. */
function useNativeAppleSignIn(): boolean {
	const [available, setAvailable] = useState(false)
	useEffect(() => {
		if (Platform.OS !== 'ios') return
		AppleAuthentication.isAvailableAsync()
			.then(setAvailable)
			.catch(() => setAvailable(false))
	}, [])
	return available
}

const SIGN_IN_NOT_SET_UP = "Sign-in isn't set up in this version of the app yet."

export default function LoginScreen() {
	const insets = useSafeAreaInsets()
	const { layout, radii, isDark } = useTheme()
	const nativeApple = useNativeAppleSignIn()
	const s = useStyles()

	const [step, setStep] = useState<'email' | 'otp'>('email')
	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [loading, setLoading] = useState<'email' | 'code' | Provider | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [codeError, setCodeError] = useState(false)
	const [cooldown, setCooldown] = useState(0)
	const [failedAttempts, setFailedAttempts] = useState(0)
	const [lockoutEnd, setLockoutEnd] = useState<number | null>(null)
	const [lockoutLeft, setLockoutLeft] = useState(0)

	const codeRef = useRef<TextInput>(null)

	// Resend cooldown countdown
	useEffect(() => {
		if (cooldown <= 0) return
		const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
		return () => clearTimeout(t)
	}, [cooldown])

	// Lockout countdown
	useEffect(() => {
		if (!lockoutEnd) return
		const tick = () => {
			const rem = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000))
			setLockoutLeft(rem)
			if (rem === 0) setLockoutEnd(null)
		}
		tick()
		const t = setInterval(tick, 1000)
		return () => clearInterval(t)
	}, [lockoutEnd])

	async function sendCode() {
		const normalized = normalizeEmail(email)
		if (!looksLikeEmail(normalized)) {
			setError('Enter a valid email address.')
			haptic.warning()
			return
		}
		if (DISPOSABLE_DOMAINS.has(normalized.split('@')[1] ?? '')) {
			setError('Temporary email addresses are not allowed. Use one you keep.')
			haptic.warning()
			return
		}
		track('login_started', { method: 'email' })
		if (!isSupabaseEnabled) {
			track('login_failed', { method: 'email', reason: 'provider' })
			setError(SIGN_IN_NOT_SET_UP)
			return
		}
		setLoading('email')
		setError(null)
		const { error: err } = await supabase.auth.signInWithOtp({ email: normalized })
		setLoading(null)
		if (err) {
			setError(err.message)
			return
		}
		track('otp_sent')
		setStep('otp')
		setCooldown(RESEND_COOLDOWN_S)
		setTimeout(() => codeRef.current?.focus(), 350)
	}

	const verify = useCallback(
		async (value: string) => {
			if (value.length < CODE_LENGTH) return
			if (lockoutEnd && Date.now() < lockoutEnd) {
				setError('Too many attempts. Wait for the timer, then try again.')
				track('login_failed', { method: 'email', reason: 'locked' })
				return
			}
			setLoading('code')
			setError(null)
			const { error: err } = await supabase.auth.verifyOtp({
				email: normalizeEmail(email),
				token: value,
				type: 'email'
			})
			setLoading(null)
			if (err) {
				const next = failedAttempts + 1
				setFailedAttempts(next)
				setCodeError(true)
				setCode('')
				if (next >= MAX_ATTEMPTS) {
					setLockoutEnd(Date.now() + LOCKOUT_MS)
					setError('Too many wrong codes. Wait 15 minutes, then try again.')
					track('login_failed', { method: 'email', reason: 'locked' })
				} else {
					const left = MAX_ATTEMPTS - next
					setError(`That code didn't match. ${left} attempt${left === 1 ? '' : 's'} left.`)
					track('login_failed', { method: 'email', reason: 'invalid_code' })
				}
				return
			}
			haptic.success()
			track('login_success', { method: 'email' })
		},
		[email, lockoutEnd, failedAttempts]
	)

	function onCodeChange(next: string) {
		setCode(next)
		if (codeError) setCodeError(false)
		if (error && !lockoutEnd) setError(null)
		if (next.length === CODE_LENGTH) void verify(next)
	}

	async function resend() {
		if (cooldown > 0) return
		setLoading('email')
		setError(null)
		const { error: err } = await supabase.auth.signInWithOtp({ email: normalizeEmail(email) })
		setLoading(null)
		if (err) {
			setError(err.message)
			return
		}
		haptic.success()
		setCooldown(RESEND_COOLDOWN_S)
		setCode('')
		codeRef.current?.focus()
	}

	function changeEmail() {
		setStep('email')
		setCode('')
		setError(null)
		setCodeError(false)
		setFailedAttempts(0)
		setLockoutEnd(null)
	}

	// Apple's native sheet (iOS). Its identity token is exchanged for a Supabase
	// session; no browser, no redirect.
	async function signInWithApple() {
		track('login_started', { method: 'apple' })
		if (!isSupabaseEnabled) {
			track('login_failed', { method: 'apple', reason: 'provider' })
			setError(SIGN_IN_NOT_SET_UP)
			return
		}
		setLoading('apple')
		setError(null)
		try {
			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [
					AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
					AppleAuthentication.AppleAuthenticationScope.EMAIL
				]
			})
			if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token.")
			const { error: err } = await supabase.auth.signInWithIdToken({
				provider: 'apple',
				token: credential.identityToken
			})
			if (err) throw err
			// Apple shares the name on the first sign-in only, and never in the
			// token, so keep it now or lose it.
			const fullName = credential.fullName
				? AppleAuthentication.formatFullName(credential.fullName).trim()
				: ''
			if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } })
			haptic.success()
			track('login_success', { method: 'apple' })
		} catch (e) {
			if ((e as { code?: string } | undefined)?.code === 'ERR_REQUEST_CANCELED') {
				track('login_failed', { method: 'apple', reason: 'cancelled' })
				return
			}
			track('login_failed', { method: 'apple', reason: 'provider' })
			setError(
				(e as { message?: string } | undefined)?.message ?? "Apple sign-in didn't work. Try again."
			)
		} finally {
			setLoading(null)
		}
	}

	async function signInWithProvider(provider: Provider) {
		const name = provider === 'google' ? 'Google' : 'Apple'
		track('login_started', { method: provider })
		if (!isSupabaseEnabled) {
			track('login_failed', { method: provider, reason: 'provider' })
			setError(SIGN_IN_NOT_SET_UP)
			return
		}
		setLoading(provider)
		setError(null)
		try {
			const redirectTo = `${APP_SCHEME}://auth/callback`
			const { data, error: err } = await supabase.auth.signInWithOAuth({
				provider,
				options: { redirectTo, skipBrowserRedirect: true }
			})
			if (err) throw err
			if (!data.url) throw new Error(`${name} sign-in isn't set up yet.`)

			const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
			if (result.type !== 'success') {
				track('login_failed', { method: provider, reason: 'cancelled' })
				return
			}
			const { error: sessionErr } = await supabase.auth.exchangeCodeForSession(result.url)
			if (sessionErr) throw sessionErr
			track('login_success', { method: provider })
		} catch (e) {
			track('login_failed', { method: provider, reason: 'provider' })
			setError(
				(e as { message?: string } | undefined)?.message ??
					`${name} sign-in didn't work. Try again.`
			)
		} finally {
			setLoading(null)
		}
	}

	return (
		<View style={s.root}>
			<PageHeader />
			<KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<ScrollView
					contentContainerStyle={[
						s.scroll,
						{ paddingHorizontal: layout.gutterWide, paddingBottom: insets.bottom + 24 }
					]}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<LogoMark name={APP_NAME} size={44} />

					{step === 'email' ? (
						<Animated.View key="email" entering={stepIn} exiting={stepOut} style={s.step}>
							<View style={s.titles}>
								<Text variant="h1" accessibilityRole="header">
									Sign in to {APP_NAME}
								</Text>
								<Text variant="body" tone="secondary">
									We&apos;ll email you a six-digit code. No password to remember.
								</Text>
							</View>

							<TextInputField
								label="Email"
								icon={(color) => <Mail size={18} color={color} strokeWidth={2} />}
								value={email}
								onChangeText={(v) => {
									setEmail(v)
									if (error) setError(null)
								}}
								placeholder="you@example.com"
								keyboardType="email-address"
								textContentType="emailAddress"
								autoComplete="email"
								autoCapitalize="none"
								autoCorrect={false}
								returnKeyType="send"
								onSubmitEditing={sendCode}
								error={error}
								autoFocus
							/>

							<Button
								label="Email me a code"
								size="lg"
								fullWidth
								loading={loading === 'email'}
								disabled={!email.trim() || (loading !== null && loading !== 'email')}
								onPress={sendCode}
							/>

							<View style={s.divider}>
								<View style={s.rule} />
								<Text variant="caption" tone="tertiary">
									or
								</Text>
								<View style={s.rule} />
							</View>

							<View style={s.providers}>
								{nativeApple ? (
									<View
										pointerEvents={loading !== null ? 'none' : 'auto'}
										style={loading !== null && s.dimmed}
									>
										<AppleAuthentication.AppleAuthenticationButton
											buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
											buttonStyle={
												isDark
													? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
													: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
											}
											cornerRadius={Math.min(radii.button, PROVIDER_HEIGHT / 2)}
											style={s.appleButton}
											onPress={signInWithApple}
										/>
									</View>
								) : (
									<Button
										label="Continue with Apple"
										variant="outline"
										size="lg"
										fullWidth
										loading={loading === 'apple'}
										disabled={loading !== null && loading !== 'apple'}
										icon={(color) => <Ionicons name="logo-apple" size={18} color={color} />}
										onPress={() => signInWithProvider('apple')}
									/>
								)}
								<Button
									label="Continue with Google"
									variant="outline"
									size="lg"
									fullWidth
									loading={loading === 'google'}
									disabled={loading !== null && loading !== 'google'}
									icon={(color) => <Ionicons name="logo-google" size={16} color={color} />}
									onPress={() => signInWithProvider('google')}
								/>
							</View>
						</Animated.View>
					) : (
						<Animated.View key="otp" entering={stepIn} exiting={stepOut} style={s.step}>
							<View style={s.titles}>
								<Text variant="h1" accessibilityRole="header">
									Check your inbox
								</Text>
								<Text variant="body" tone="secondary">
									Enter the code we sent to{' '}
									<Text variant="body" tone="primary">
										{normalizeEmail(email)}
									</Text>
									. It can take a minute; check spam too.
								</Text>
							</View>

							<CodeInput
								value={code}
								onChange={onCodeChange}
								inputRef={codeRef}
								disabled={loading === 'code' || !!lockoutEnd}
								error={codeError}
							/>

							{error ? (
								<Text variant="bodySm" tone="error" accessibilityLiveRegion="polite">
									{error}
								</Text>
							) : null}
							{lockoutEnd ? (
								<Text variant="bodySm" tone="secondary" tabular>
									Try again in {Math.floor(lockoutLeft / 60)}:
									{String(lockoutLeft % 60).padStart(2, '0')}
								</Text>
							) : null}

							<Button
								label="Verify"
								size="lg"
								fullWidth
								loading={loading === 'code'}
								disabled={code.length < CODE_LENGTH || !!lockoutEnd}
								onPress={() => verify(code)}
							/>

							<View style={s.otpActions}>
								<Button
									label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
									variant="ghost"
									size="sm"
									disabled={cooldown > 0 || loading !== null}
									onPress={resend}
								/>
								<Button label="Change email" variant="ghost" size="sm" onPress={changeEmail} />
							</View>
						</Animated.View>
					)}

					{__DEV__ ? (
						<View style={s.dev}>
							<Text variant="caption" tone="tertiary">
								Development build
							</Text>
							<View style={s.devRow}>
								<Button
									label="Skip to the app"
									variant="outline"
									size="sm"
									onPress={() => DeviceEventEmitter.emit('__dev_skip_auth__')}
								/>
								<Button
									label="Skip to onboarding"
									variant="outline"
									size="sm"
									onPress={() => DeviceEventEmitter.emit('__dev_skip_auth__', { onboarding: true })}
								/>
							</View>
						</View>
					) : null}

					<View style={s.legal}>
						<Button
							label="Privacy Policy"
							variant="ghost"
							size="sm"
							onPress={() => router.push('/privacy')}
						/>
						<Button
							label="Terms of Service"
							variant="ghost"
							size="sm"
							onPress={() => router.push('/terms')}
						/>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	)
}

const useStyles = makeStyles((c) => ({
	root: { flex: 1, backgroundColor: c.bg },
	flex: { flex: 1 },
	scroll: { flexGrow: 1, paddingTop: 12, gap: 28 },
	step: { gap: 20 },
	titles: { gap: 10 },
	divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderSoft },
	providers: { gap: 10 },
	appleButton: { width: '100%', height: PROVIDER_HEIGHT },
	dimmed: { opacity: 0.5 },
	otpActions: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
	dev: {
		gap: 10,
		padding: 14,
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: c.borderSoft,
		borderStyle: 'dashed'
	},
	devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	legal: { flexDirection: 'row', justifyContent: 'center', marginTop: 'auto' }
}))
