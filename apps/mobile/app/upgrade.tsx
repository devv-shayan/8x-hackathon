/**
 * The paywall.
 *
 * To customise:
 *   1. 🎨 BRAND: the headline, subtitle and PRO_FEATURES below.
 *   2. Prices, periods and trials come from the store through RevenueCat —
 *      never write a price into the app. Create the products in App Store
 *      Connect / Play Console, add them to a RevenueCat offering, and set the
 *      entitlement to 'premium' (or change ENTITLEMENT_ID in lib/purchases.ts).
 *
 * Store rules this screen carries (Apple 3.1.1 / 3.1.2, Play subscriptions):
 * price and period before purchase, what the trial becomes, Restore, Terms of
 * Use and Privacy Policy links, and the auto-renew disclosure. Keep them.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
	Linking,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	useWindowDimensions,
	type AppStateStatus
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	BadgeCheck,
	CalendarClock,
	Check,
	Gift,
	Infinity as InfinityIcon,
	RotateCcw,
	Sparkles,
	Zap,
	Headphones,
	Rocket,
	type LucideIcon
} from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { AlertModal } from '@/components/ui/AppModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Glow } from '@/components/ui/Marks'
import { PageHeader } from '@/components/ui/PageHeader'
import { SELECTION_ROW_HEIGHT, SelectionRow } from '@/components/ui/SelectionRow'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import Purchases from 'react-native-purchases'
import { track } from '@/lib/analytics'
import { devPlaceholders } from '@/lib/devPlaceholders'
import { haptic } from '@/lib/haptics'
import { periodPhrase, plansFromOfferings, type PlanOption } from '@/lib/paywall'
import { MANAGE_SUBSCRIPTIONS_URL } from '@/lib/purchases'
import { makeStyles } from '@/lib/themedStyles'

// 🎨 BRAND: what Premium unlocks in your app. Four is plenty.
const PRO_FEATURES: { icon: LucideIcon; label: string }[] = [
	{ icon: InfinityIcon, label: 'Unlimited use of every feature' },
	{ icon: Zap, label: 'Faster, with no waiting' },
	{ icon: Rocket, label: 'New features first' },
	{ icon: Headphones, label: 'Priority support' }
]

const STORE = Platform.OS === 'ios' ? 'App Store' : 'Google Play'
/** Height of one plan card (SelectionRow's), so the skeletons reserve exactly its space. */
const PLAN_HEIGHT = SELECTION_ROW_HEIGHT

export default function UpgradeScreen() {
	const insets = useSafeAreaInsets()
	const { height } = useWindowDimensions()
	const { colors: c, layout, radii } = useTheme()
	const s = useStyles()
	const { showToast } = useToast()
	const {
		isPremium,
		isLoading,
		offerings,
		offeringsStatus,
		purchase,
		restore,
		refresh,
		customerInfo
	} = useSubscription()

	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [purchasing, setPurchasing] = useState(false)
	const [restoring, setRestoring] = useState(false)
	const [waitingForRedeem, setWaitingForRedeem] = useState(false)
	const [shelfH, setShelfH] = useState(0)
	const waitingRef = useRef(false)
	const [modal, setModal] = useState<{ title: string; message: string } | null>(null)

	const livePlans = useMemo(() => plansFromOfferings(offerings), [offerings])
	// Development builds with no store products get sample plans to design
	// against; they are labelled as a preview and cannot be bought.
	const preview = offeringsStatus === 'unavailable' && !!devPlaceholders
	const plans: PlanOption[] = preview ? (devPlaceholders?.paywallPreview ?? []) : livePlans
	const selected = plans.find((p) => p.id === selectedId) ?? plans[0] ?? null
	const loadingPlans = offeringsStatus === 'loading' || isLoading

	useEffect(() => {
		track('upgrade_page_viewed')
	}, [])

	// Auto-restore when returning from the Play Store redeem flow
	useEffect(() => {
		const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
			if (next === 'active' && waitingRef.current) {
				waitingRef.current = false
				setWaitingForRedeem(false)
				const result = await restore()
				if (result.success) await refresh()
			}
		})
		return () => sub.remove()
	}, [restore, refresh])

	function select(plan: PlanOption) {
		if (plan.id === selected?.id) return
		setSelectedId(plan.id)
		track('upgrade_plan_selected', { package: plan.id })
	}

	async function buy() {
		if (!selected?.pkg || purchasing) return
		track('upgrade_cta_tapped', { package: selected.id })
		setPurchasing(true)
		try {
			const result = await purchase(selected.pkg)
			if (result.success) {
				track('purchase_success', { package: selected.id })
				await refresh()
				haptic.success()
				router.back()
			} else if (!result.cancelled) {
				haptic.error()
				setModal({
					title: "The purchase didn't go through",
					message: result.error ?? 'Nothing was charged. Please try again.'
				})
			}
		} finally {
			setPurchasing(false)
		}
	}

	async function handleRestore() {
		if (restoring) return
		track('restore_purchases_tapped')
		setRestoring(true)
		try {
			const result = await restore()
			if (!result.success) {
				setModal({
					title: "Couldn't restore",
					message: result.error ?? 'Something went wrong. Please try again.'
				})
			} else if (result.premium) {
				await refresh()
				haptic.success()
				setModal({ title: 'Restored', message: 'Your subscription is active on this device.' })
			} else {
				setModal({
					title: 'Nothing to restore',
					message: `No active subscription was found for this ${STORE} account.`
				})
			}
		} finally {
			setRestoring(false)
		}
	}

	async function handleRedeem() {
		track('redeem_code_tapped')
		if (Platform.OS === 'ios') {
			try {
				await Purchases.presentCodeRedemptionSheet()
			} catch {
				Linking.openURL('https://apps.apple.com/redeem')
			}
		} else {
			waitingRef.current = true
			setWaitingForRedeem(true)
			const canUseMarket = await Linking.canOpenURL('market://redeem')
			Linking.openURL(canUseMarket ? 'market://redeem' : 'https://play.google.com/redeem')
		}
	}

	function openLegal(document: 'terms' | 'privacy') {
		track('upgrade_legal_link_tapped', { document })
		router.push(document === 'terms' ? '/terms' : '/privacy')
	}

	const expiryMs = customerInfo?.entitlements.active['premium']?.expirationDate
	const willRenew = customerInfo?.entitlements.active['premium']?.willRenew ?? false
	const expiry = expiryMs
		? new Date(expiryMs).toLocaleDateString(undefined, {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			})
		: null

	const priceLine = selected
		? selected.trialDays
			? `${selected.trialDays} days free, then ${selected.price} ${periodPhrase(selected.period)}`
			: `${selected.price} ${periodPhrase(selected.period)} · cancel anytime`
		: ''
	const showShelf = !isPremium

	return (
		<View style={s.root}>
			<Glow size={height * 0.7} strength={1.3} style={s.glow} />
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: layout.gutterWide,
					paddingBottom: (showShelf ? shelfH : insets.bottom) + 28,
					gap: 22
				}}
				showsVerticalScrollIndicator={false}
			>
				<View style={s.header}>
					<PageHeader backIcon="close" />
				</View>

				<FadeSlideIn index={0} style={s.hero}>
					<View style={[s.heroChip, { backgroundColor: c.brandDim }]}>
						<Sparkles size={22} color={c.brandInk} strokeWidth={2} />
					</View>
					{/* 🎨 BRAND: your promise, in a line. */}
					<Text variant="display" style={s.center} accessibilityRole="header">
						Unlock everything
					</Text>
					<Text variant="lead" tone="secondary" style={s.center}>
						All of the app, with nothing held back.
					</Text>
				</FadeSlideIn>

				<FadeSlideIn index={1} style={s.features}>
					{PRO_FEATURES.map(({ icon: Icon, label }) => (
						<View key={label} style={s.feature}>
							<View style={[s.featureChip, { backgroundColor: c.brandDim }]}>
								<Icon size={16} color={c.brandInk} strokeWidth={2} />
							</View>
							<Text variant="body" style={s.flex}>
								{label}
							</Text>
						</View>
					))}
				</FadeSlideIn>

				{isPremium ? (
					<FadeSlideIn index={2}>
						<Card tier="selected" padding="spacious" style={s.gap10}>
							<BadgeCheck size={24} color={c.brandInk} strokeWidth={2} />
							<Text variant="h3">You&apos;re on Premium</Text>
							{expiry ? (
								<Text variant="bodySm" tone="secondary">
									{willRenew ? `Renews on ${expiry}` : `Ends on ${expiry}`}
								</Text>
							) : null}
							<Button
								label={`Manage in ${STORE}`}
								variant="outline"
								size="sm"
								onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
								style={s.gapTop}
							/>
						</Card>
					</FadeSlideIn>
				) : (
					<>
						<FadeSlideIn index={2} style={s.plans}>
							{preview ? (
								<Text variant="caption" tone="warning">
									Preview prices — development build only. Real prices come from the store.
								</Text>
							) : null}
							{loadingPlans ? (
								<>
									<Skeleton height={PLAN_HEIGHT} radius={radii.row} />
									<Skeleton height={PLAN_HEIGHT} radius={radii.row} />
								</>
							) : plans.length === 0 ? (
								<Card tier="well" style={s.gap10}>
									<Text variant="label">Plans aren&apos;t available right now</Text>
									<Text variant="bodySm" tone="secondary">
										The {STORE} didn&apos;t return any plans. Check your connection and try again.
									</Text>
									<Button
										label="Try again"
										variant="outline"
										size="sm"
										onPress={() => refresh()}
										style={s.gapTop}
									/>
								</Card>
							) : (
								<View accessibilityRole="radiogroup" style={s.gap10}>
									{plans.map((plan) => (
										<SelectionRow
											key={plan.id}
											title={plan.title}
											subtitle={
												[
													plan.savingsPct ? `Save ${plan.savingsPct}%` : null,
													plan.perMonth ?? (plan.period === 'month' ? 'Billed monthly' : null)
												]
													.filter(Boolean)
													.join(' · ') || undefined
											}
											selected={plan.id === selected?.id}
											onPress={() => select(plan)}
											accessibilityLabel={`${plan.title}, ${plan.price} ${periodPhrase(plan.period)}`}
											trailing={
												<View style={s.price}>
													<Text variant="label" tabular>
														{plan.price}
													</Text>
													<Text variant="caption" tone="tertiary">
														{periodPhrase(plan.period)}
													</Text>
												</View>
											}
										/>
									))}
								</View>
							)}
						</FadeSlideIn>

						{selected?.trialDays ? (
							<FadeSlideIn index={3}>
								<TrialTimeline
									days={selected.trialDays}
									price={`${selected.price} ${periodPhrase(selected.period)}`}
								/>
							</FadeSlideIn>
						) : null}

						<FadeSlideIn index={4} style={s.footer}>
							<View style={s.links}>
								<Button
									label="Restore purchases"
									variant="ghost"
									size="sm"
									loading={restoring}
									disabled={waitingForRedeem}
									icon={(color) => <RotateCcw size={14} color={color} strokeWidth={2} />}
									onPress={handleRestore}
								/>
								<Button
									label="Redeem a code"
									variant="ghost"
									size="sm"
									loading={waitingForRedeem}
									disabled={restoring}
									icon={(color) => <Gift size={14} color={color} strokeWidth={2} />}
									onPress={handleRedeem}
								/>
							</View>
							{/* Apple 3.1.2: the purchase flow links to the Terms of Use and the
							    Privacy Policy. Both must work; a paywall without them is rejected. */}
							<View style={s.links}>
								<Button
									label="Terms of Use"
									variant="ghost"
									size="sm"
									onPress={() => openLegal('terms')}
								/>
								<Button
									label="Privacy Policy"
									variant="ghost"
									size="sm"
									onPress={() => openLegal('privacy')}
								/>
							</View>
							<Text variant="caption" tone="tertiary" style={s.center}>
								Subscriptions renew automatically unless cancelled at least 24 hours before the end
								of the current period. Your {STORE} account is charged at confirmation of purchase
								and at each renewal. Manage or cancel any time in your {STORE} account settings.
							</Text>
						</FadeSlideIn>
					</>
				)}
			</ScrollView>

			{showShelf ? (
				<View
					onLayout={(e) => setShelfH(e.nativeEvent.layout.height)}
					style={[
						s.shelf,
						{ paddingBottom: insets.bottom + 12, paddingHorizontal: layout.gutterWide }
					]}
				>
					<Text variant="bodySm" tone="secondary" style={s.center} tabular numberOfLines={1}>
						{loadingPlans ? ' ' : priceLine}
					</Text>
					<Button
						label={selected?.trialDays ? 'Start free trial' : 'Continue'}
						size="lg"
						withArrow
						fullWidth
						loading={purchasing}
						disabled={!selected?.pkg}
						onDisabledPress={() => {
							haptic.warning()
							if (preview) {
								showToast("Preview plans can't be bought. Add store products to test.", 'info')
							}
						}}
						onPress={buy}
					/>
				</View>
			) : null}

			<AlertModal
				visible={!!modal}
				title={modal?.title ?? ''}
				message={modal?.message}
				onDismiss={() => setModal(null)}
			/>
		</View>
	)
}

/**
 * What the trial becomes, told plainly: today, and the day it turns into a
 * paid subscription. No promise of a reminder the app does not send.
 */
function TrialTimeline({ days, price }: { days: number; price: string }) {
	const { colors: c } = useTheme()
	const s = useStyles()
	const steps = [
		{ icon: Check, title: 'Today', body: 'Full access starts. Nothing is charged.' },
		{
			icon: CalendarClock,
			title: `Day ${days}`,
			body: `The trial ends and ${price} begins, unless you cancel before.`
		}
	]
	return (
		<Card tier="well" padding="spacious">
			<Text variant="eyebrow" tone="secondary" style={s.timelineTitle}>
				How the free trial works
			</Text>
			{steps.map((step, i) => {
				const Icon = step.icon
				const lastStep = i === steps.length - 1
				return (
					<View key={step.title} style={s.step}>
						<View style={s.rail}>
							<View style={[s.node, { backgroundColor: i === 0 ? c.brandFill : c.surface3 }]}>
								<Icon size={14} color={i === 0 ? c.onBrand : c.textSecondary} strokeWidth={2.4} />
							</View>
							{lastStep ? null : <View style={[s.line, { backgroundColor: c.borderActive }]} />}
						</View>
						<View style={[s.flex, !lastStep && s.stepGap]}>
							<Text variant="label">{step.title}</Text>
							<Text variant="bodySm" tone="secondary">
								{step.body}
							</Text>
						</View>
					</View>
				)
			})}
		</Card>
	)
}

const useStyles = makeStyles((c, t) => ({
	root: { flex: 1, backgroundColor: c.bg },
	glow: { position: 'absolute', alignSelf: 'center', top: -220 },
	// PageHeader brings its own side padding; cancel the scroll gutter under it.
	header: { marginHorizontal: -t.layout.gutterWide },
	hero: { alignItems: 'center', gap: 12, paddingTop: 4 },
	heroChip: {
		width: 52,
		height: 52,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center'
	},
	center: { textAlign: 'center' },
	features: { gap: 12 },
	feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	featureChip: {
		width: 32,
		height: 32,
		borderRadius: 11,
		alignItems: 'center',
		justifyContent: 'center'
	},
	flex: { flex: 1 },
	plans: { gap: 10 },
	price: { alignItems: 'flex-end' },
	gap10: { gap: 10 },
	gapTop: { marginTop: 6 },
	footer: { gap: 6, alignItems: 'center' },
	links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
	timelineTitle: { marginBottom: 14 },
	step: { flexDirection: 'row', gap: 12 },
	rail: { alignItems: 'center', width: 28 },
	node: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
	line: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
	stepGap: { paddingBottom: 16 },
	shelf: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingTop: 12,
		gap: 10,
		backgroundColor: c.surface,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: c.borderSoft,
		...t.elevation.overlay,
		shadowOffset: { width: 0, height: -4 }
	}
}))
