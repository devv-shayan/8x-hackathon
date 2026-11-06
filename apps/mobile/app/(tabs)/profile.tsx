import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BadgeCheck, FileText, LifeBuoy, LogOut, Settings, ShieldCheck } from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { TeacherBadge } from '@/components/profile/TeacherBadge'
import { InlineQueryError } from '@/components/QueryError'
import { useTabBarClearance } from '@/components/TabBar'
import type { IconComponent } from '@/components/ui/List'
import { AlertModal } from '@/components/ui/AppModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useProfile } from '@/hooks/useProfile'
import { track } from '@/lib/analytics'
import { logoutRevenueCat } from '@/lib/purchases'
import { supabase } from '@/lib/supabase'

const ICON_SIZE = 20
const ICON_STROKE = 2

function LinkTile({
	icon: Icon,
	title,
	onPress
}: {
	icon: IconComponent
	title: string
	onPress: () => void
}) {
	const { colors: c, radii } = useTheme()
	return (
		<PressableScale
			scaleTo="card"
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={title}
			style={[s.tile, { backgroundColor: c.surface, borderRadius: radii.xl }]}
		>
			<Icon size={ICON_SIZE} color={c.textPrimary} strokeWidth={ICON_STROKE} />
			<Text variant="label" numberOfLines={1}>
				{title}
			</Text>
		</PressableScale>
	)
}

export default function ProfileScreen() {
	const { colors: c, radii, layout } = useTheme()
	const clearance = useTabBarClearance()
	const { isPremium, customerInfo } = useSubscription()
	const profileQuery = useProfile()
	const profile = profileQuery.data
	const [confirmSignOut, setConfirmSignOut] = useState(false)
	const [signingOut, setSigningOut] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		track('profile_viewed')
	}, [])

	const expiryMs = customerInfo?.entitlements.active['premium']?.expirationDate
	const renews = expiryMs
		? new Date(expiryMs).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})
		: null

	async function signOut() {
		setSigningOut(true)
		try {
			track('logout')
			await logoutRevenueCat()
			const { error: err } = await supabase.auth.signOut()
			if (err) throw err
		} catch (e) {
			setError(
				(e as { message?: string } | undefined)?.message ?? "Couldn't sign out. Please try again."
			)
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<View style={s.flex}>
			<PixelBackdrop scene="home" />
			<ScrollView
				contentContainerStyle={{ paddingBottom: clearance }}
				showsVerticalScrollIndicator={false}
			>
				<FadeSlideIn index={0}>
					<TeacherBadge
						id={profile?.id}
						name={profile?.fullName}
						email={profile?.email}
						createdAt={profile?.createdAt}
					>
						{profile ? null : profileQuery.isError ? (
							<InlineQueryError error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
						) : (
							<>
								<Skeleton width="60%" height={24} />
								<Skeleton width="80%" height={14} />
							</>
						)}
					</TeacherBadge>
				</FadeSlideIn>

				<View style={[s.below, { paddingHorizontal: layout.gutter }]}>
					{isPremium ? (
						<FadeSlideIn index={1}>
							<Card tier="selected">
								<View style={s.planRow}>
									<BadgeCheck size={22} color={c.brandInk} strokeWidth={2} />
									<View style={s.flex}>
										<Text variant="label">Premium is on</Text>
										<Text variant="caption" tone="secondary">
											{renews ? `Renews ${renews}` : 'Your subscription is active'}
										</Text>
									</View>
									<Button
										label="Manage"
										variant="secondary"
										size="sm"
										onPress={() => router.push('/upgrade')}
									/>
								</View>
							</Card>
						</FadeSlideIn>
					) : null}

					<FadeSlideIn index={2} style={s.tiles}>
						<LinkTile icon={Settings} title="Settings" onPress={() => router.push('/settings')} />
						<LinkTile
							icon={LifeBuoy}
							title="Help & support"
							onPress={() => router.push('/support')}
						/>
						<LinkTile
							icon={FileText}
							title="Privacy Policy"
							onPress={() => router.push('/privacy')}
						/>
						<LinkTile
							icon={ShieldCheck}
							title="Terms of Service"
							onPress={() => router.push('/terms')}
						/>
					</FadeSlideIn>

					<FadeSlideIn index={3}>
						<PressableScale
							scaleTo="card"
							disabled={signingOut}
							onPress={() => setConfirmSignOut(true)}
							accessibilityRole="button"
							accessibilityLabel="Sign out"
							style={[s.signOut, { backgroundColor: c.surface, borderRadius: radii.xl }]}
						>
							<LogOut size={ICON_SIZE} color={c.error} strokeWidth={ICON_STROKE} />
							<Text variant="label" style={{ color: c.error }}>
								{signingOut ? 'Signing out…' : 'Sign out'}
							</Text>
						</PressableScale>
					</FadeSlideIn>
				</View>
			</ScrollView>

			<AlertModal
				visible={confirmSignOut}
				title="Sign out?"
				message="You'll need your email to sign back in."
				buttons={[
					{ text: 'Sign out', style: 'destructive', onPress: signOut },
					{ text: 'Cancel', style: 'cancel' }
				]}
				onDismiss={() => setConfirmSignOut(false)}
			/>
			<AlertModal
				visible={!!error}
				title="Couldn't sign out"
				message={error ?? ''}
				onDismiss={() => setError(null)}
			/>
		</View>
	)
}

const s = StyleSheet.create({
	flex: { flex: 1 },
	below: { marginTop: 20, gap: 8 },
	planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	tile: { flexGrow: 1, flexBasis: '47%', padding: 14, gap: 8 },
	signOut: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }
})
