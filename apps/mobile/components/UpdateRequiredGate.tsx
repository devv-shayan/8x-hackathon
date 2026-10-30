import { useEffect, useState } from 'react'
import { Linking, Modal, Platform, View, useWindowDimensions } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Application from 'expo-application'
import { CircleArrowUp } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Glow } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { track } from '@/lib/analytics'
import { checkForRequiredUpdate, type RequiredUpdate } from '@/lib/appConfig'
import { APP_NAME } from '@/lib/constants'
import { useColors } from '@/contexts/ThemeContext'
import { log } from '@/lib/logger'
import { makeStyles } from '@/lib/themedStyles'
import { numericStyle } from '@/lib/typography'

/**
 * The minimum-version gate: a full-screen "Update required" when this native
 * build is older than the server's `min_supported_version` (lib/appConfig.ts).
 *
 * It checks once, on launch, while the app opens as usual underneath. It never
 * blocks on the network: until a valid response names a higher minimum, it
 * renders nothing. A Modal, so it sits above every screen and overlay, and the
 * Android back button can't dismiss it.
 */
export default function UpdateRequiredGate() {
	const [update, setUpdate] = useState<RequiredUpdate | null>(null)

	useEffect(() => {
		let active = true
		void checkOncePerLaunch().then((required) => {
			if (active && required) setUpdate(required)
		})
		return () => {
			active = false
		}
	}, [])

	if (!update) return null
	return <UpdateRequiredScreen update={update} />
}

// The root layout can remount its tree (auth and onboarding state), so the
// request and the `viewed` event are kept to one per launch here.
let launchCheck: Promise<RequiredUpdate | null> | undefined

function checkOncePerLaunch(): Promise<RequiredUpdate | null> {
	launchCheck ??= (async () => {
		// Expo Go reports its own version, not this app's; web has no store build.
		if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null
		if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null
		const required = await checkForRequiredUpdate({
			platform: Platform.OS,
			appVersion: Application.nativeApplicationVersion
		})
		if (required) track('update_required_viewed', eventProperties(required))
		return required
	})()
	return launchCheck
}

function eventProperties(update: RequiredUpdate) {
	return { app_version: update.appVersion, min_supported_version: update.minSupportedVersion }
}

function UpdateRequiredScreen({ update }: { update: RequiredUpdate }) {
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const c = useColors()
	const s = useStyles()
	const store = Platform.OS === 'ios' ? 'the App Store' : 'Google Play'

	const openStore = () => {
		track('update_required_store_link_tapped', eventProperties(update))
		Linking.openURL(update.storeUrl).catch((error: unknown) => {
			log.warn('Could not open the store listing', { error })
		})
	}

	return (
		<Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
			<View
				style={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
				accessibilityViewIsModal
			>
				<Glow size={width * 1.4} style={[s.glow, { left: -width * 0.2 }]} />
				<View style={s.body}>
					<FadeSlideIn index={0} style={s.art}>
						<View style={s.tile}>
							<CircleArrowUp size={28} color={c.brandInk} strokeWidth={1.8} />
						</View>
					</FadeSlideIn>
					<FadeSlideIn index={1} style={s.copy}>
						<Eyebrow>{APP_NAME}</Eyebrow>
						<Text variant="h1" style={s.centered} accessibilityRole="header">
							Update required
						</Text>
						<Text variant="lead" tone="secondary" style={s.centered}>
							This version is no longer supported. Get the latest from {store} to keep using the
							app.
						</Text>
					</FadeSlideIn>
					<FadeSlideIn index={2} style={s.versions}>
						<Card tier="well" padding="compact">
							<VersionRow label="On this phone" value={update.appVersion} />
							<View style={s.divider} />
							<VersionRow label="Needed" value={`${update.minSupportedVersion} or later`} />
						</Card>
					</FadeSlideIn>
				</View>
				<FadeSlideIn index={3}>
					<Button label={`Update on ${store}`} size="lg" fullWidth withArrow onPress={openStore} />
				</FadeSlideIn>
			</View>
		</Modal>
	)
}

function VersionRow({ label, value }: { label: string; value: string }) {
	const s = useStyles()
	return (
		<View style={s.row}>
			<Text variant="bodySm" tone="secondary">
				{label}
			</Text>
			<Text variant="label" style={numericStyle}>
				{value}
			</Text>
		</View>
	)
}

const useStyles = makeStyles((c, t) => ({
	container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: t.layout.gutter },
	glow: { position: 'absolute', top: -120 },
	body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
	art: { alignItems: 'center', justifyContent: 'center' },
	tile: {
		width: 72,
		height: 72,
		borderRadius: t.radii.card,
		backgroundColor: c.surface,
		borderWidth: 1,
		borderColor: c.brandBorder,
		alignItems: 'center',
		justifyContent: 'center'
	},
	copy: { alignItems: 'center', gap: 12, maxWidth: 360 },
	centered: { textAlign: 'center' },
	versions: { alignSelf: 'stretch' },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10
	},
	divider: { height: 1, backgroundColor: c.borderHairline }
}))
