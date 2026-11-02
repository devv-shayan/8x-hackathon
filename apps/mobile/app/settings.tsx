import { useState } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { FileText, ShieldCheck, Trash2, Vibrate } from 'lucide-react-native'
import { AlertModal } from '@/components/ui/AppModal'
import { ListRow, Section } from '@/components/ui/List'
import { PageHeader, ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/contexts/ToastContext'
import { AccountDeletionError, deleteAccount } from '@/lib/account'
import { track } from '@/lib/analytics'
import { APP_NAME } from '@/lib/constants'
import { hapticsPreference, saveHapticsPref } from '@/lib/haptics'
import { logoutRevenueCat } from '@/lib/purchases'
import { supabase } from '@/lib/supabase'

const DELETE_ACCOUNT_MESSAGE =
	'This permanently deletes your account and everything in it: your profile, videos, ' +
	"classes and answers. It can't be undone."

export default function SettingsScreen() {
	const { showToast } = useToast()
	const [haptics, setHaptics] = useState(hapticsPreference())
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)

	function changeHaptics(enabled: boolean) {
		setHaptics(enabled)
		void saveHapticsPref(enabled)
		track('haptics_changed', { enabled })
	}

	// ── Delete account (Apple 5.1.1(v), Google Play) ──
	function handleDeletePress() {
		if (deleting) return
		track('delete_account_tapped')
		setConfirmDelete(true)
	}

	async function handleDeleteConfirmed() {
		track('delete_account_confirmed')
		setDeleting(true)
		try {
			await deleteAccount()
		} catch (e) {
			const failure = e instanceof AccountDeletionError ? e : null
			track('delete_account_failed', { reason: failure?.reason ?? 'server' })
			setNotice({
				title: 'Account not deleted',
				message: failure?.message ?? 'Your account was not deleted. Please try again.'
			})
			setDeleting(false)
			return
		}

		// Fired before the sign-out, while PostHog still knows who this was.
		track('account_deleted')
		showToast('Your account has been deleted.', 'success')

		// End the session on this device, as signing out does in profile.tsx:
		// RevenueCat first, then Supabase. `local`, because deleting the user
		// already ended every session on the server. The auth listener in
		// app/_layout.tsx then routes to the signed-out screens.
		await logoutRevenueCat()
		const { error } = await supabase.auth.signOut({ scope: 'local' })
		if (error) {
			setDeleting(false)
			setNotice({
				title: 'Account deleted',
				message:
					"Your account has been deleted, but this device couldn't sign out. Close and reopen the app."
			})
		}
	}

	return (
		<Screen header={<PageHeader />} gap={26}>
			<ScreenTitle title="Settings" />

			{Platform.OS === 'web' ? null : (
				<Section title="Feel">
					<ListRow
						icon={Vibrate}
						title="Haptics"
						subtitle="A light tap under your finger as you use the app"
						accessory={
							<Toggle value={haptics} onValueChange={changeHaptics} accessibilityLabel="Haptics" />
						}
					/>
				</Section>
			)}

			<Section title="Legal">
				<ListRow icon={FileText} title="Privacy Policy" onPress={() => router.push('/privacy')} />
				<ListRow
					icon={ShieldCheck}
					title="Terms of Service"
					onPress={() => router.push('/terms')}
				/>
			</Section>

			<Section title="Account">
				<ListRow
					icon={Trash2}
					title={deleting ? 'Deleting account…' : 'Delete account'}
					subtitle="Permanently delete your account and its data"
					onPress={handleDeletePress}
					disabled={deleting}
					destructive
				/>
			</Section>

			<Text variant="caption" tone="tertiary" style={s.version}>
				{APP_NAME} {Constants.expoConfig?.version ?? ''}
			</Text>

			<AlertModal
				visible={confirmDelete}
				title="Delete your account?"
				message={DELETE_ACCOUNT_MESSAGE}
				buttons={[
					{ text: 'Delete account', style: 'destructive', onPress: handleDeleteConfirmed },
					{ text: 'Cancel', style: 'cancel' }
				]}
				onDismiss={() => setConfirmDelete(false)}
			/>

			<AlertModal
				visible={!!notice}
				title={notice?.title ?? ''}
				message={notice?.message}
				onDismiss={() => setNotice(null)}
			/>
		</Screen>
	)
}

const s = StyleSheet.create({
	version: { textAlign: 'center' }
})
