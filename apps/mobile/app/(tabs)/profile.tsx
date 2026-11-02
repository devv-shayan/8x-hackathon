import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BadgeCheck, FileText, LifeBuoy, LogOut, Settings, ShieldCheck } from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { InlineQueryError } from '@/components/QueryError'
import { AlertModal } from '@/components/ui/AppModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListRow, Section } from '@/components/ui/List'
import { Avatar } from '@/components/ui/Marks'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useColors } from '@/contexts/ThemeContext'
import { useProfile } from '@/hooks/useProfile'
import { track } from '@/lib/analytics'
import { devPlaceholders } from '@/lib/devPlaceholders'
import { logoutRevenueCat } from '@/lib/purchases'
import { supabase } from '@/lib/supabase'

// Demo values for development builds only; null in a release build.
const demoUser = devPlaceholders?.demoUser

export default function ProfileScreen() {
	const c = useColors()
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
		<Screen tabs gap={24}>
			<FadeSlideIn index={0} style={s.identity}>
				<Avatar initials={profile?.initials ?? '·'} size={72} />
				<View style={s.who}>
					{profile ? (
						<>
							<Text variant="title" numberOfLines={1} accessibilityRole="header">
								{profile.fullName}
							</Text>
							<Text variant="bodySm" tone="secondary" numberOfLines={1}>
								{profile.email}
							</Text>
						</>
					) : profileQuery.isError ? (
						<InlineQueryError error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
					) : (
						<>
							<Skeleton width="60%" height={24} />
							<Skeleton width="80%" height={14} />
						</>
					)}
					{/* 🎨 REPLACE: role and team have no real source yet, so they show in
					    development builds only. Wire them to your data or delete the line. */}
					{demoUser ? (
						<Text variant="caption" tone="tertiary">
							{demoUser.role} · {demoUser.teamName}
						</Text>
					) : null}
				</View>
			</FadeSlideIn>

			<FadeSlideIn index={1}>
				{isPremium ? (
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
				) : null}
			</FadeSlideIn>

			<FadeSlideIn index={2}>
				<Section title="Account">
					<ListRow
						icon={Settings}
						title="Settings"
						subtitle="Haptics, legal, your account"
						onPress={() => router.push('/settings')}
					/>
					<ListRow icon={LifeBuoy} title="Help & support" onPress={() => router.push('/support')} />
				</Section>
			</FadeSlideIn>

			<FadeSlideIn index={3}>
				<Section title="Legal">
					<ListRow icon={FileText} title="Privacy Policy" onPress={() => router.push('/privacy')} />
					<ListRow
						icon={ShieldCheck}
						title="Terms of Service"
						onPress={() => router.push('/terms')}
					/>
				</Section>
			</FadeSlideIn>

			<FadeSlideIn index={4}>
				<ListRow
					icon={LogOut}
					title={signingOut ? 'Signing out…' : 'Sign out'}
					destructive
					disabled={signingOut}
					onPress={() => setConfirmSignOut(true)}
				/>
			</FadeSlideIn>

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
		</Screen>
	)
}

const s = StyleSheet.create({
	flex: { flex: 1 },
	identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
	who: { flex: 1, gap: 3 },
	planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }
})
