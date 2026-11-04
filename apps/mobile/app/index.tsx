/**
 * Welcome — the first thing a new person sees, in the website's words and pixels: Maya and Omar
 * on the black band's tunnel, taking turns with a hand up, and one way forward.
 */
import { useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from 'react-native-reanimated'
import { placeStudents, SCENES, type StudentName } from '@app/pixel'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { useSheetFloor } from '@/components/pixel/useSheetFloor'
import { BrandMark } from '@/components/ui/BrandMark'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { APP_DESCRIPTION } from '@/lib/constants'
import { Durations } from '@/lib/motion'
import { STUDENT_LINES } from '@/lib/studentLines'

/** How long each student keeps a hand up, as in the website's hero. */
const TURN_MS = 3200
/** The top of a raised hand above a student's head, in the student's own scale. */
const HAND_ABOVE_HEAD = 0.2
/** The room the brand row and the quote take below the safe area. */
const QUOTE_ROOM = 118

export default function WelcomeScreen() {
	const { colors: c, radii, layout, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const { height } = useWindowDimensions()
	const reduceMotion = useReducedMotion()
	const { floor, onScreenLayout, onSheetLayout } = useSheetFloor()
	const [turn, setTurn] = useState<StudentName>('Omar')

	useEffect(() => {
		if (reduceMotion) return
		const timer = setInterval(() => setTurn((t) => (t === 'Omar' ? 'Maya' : 'Omar')), TURN_MS)
		return () => clearInterval(timer)
	}, [reduceMotion])

	// A short phone has no room for the quote above the raised hands, so it goes.
	const { headY, scale } = placeStudents(SCENES.welcome, floor)
	const handTop = (headY - HAND_ABOVE_HEAD * scale) * height
	const roomForQuote = floor !== null && handTop > insets.top + QUOTE_ROOM

	return (
		<View style={[s.fill, { backgroundColor: c.hero }]} onLayout={onScreenLayout}>
			<StatusBar style="light" />
			<PixelBackdrop scene="welcome" raised={{ [turn]: 1 }} floor={floor} />
			<View
				pointerEvents="none"
				style={[s.top, { paddingTop: insets.top + 12, paddingHorizontal: layout.gutterWide }]}
			>
				<BrandMark light />
				{roomForQuote ? (
					<Animated.View
						key={turn}
						entering={FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)}
						style={[
							s.quote,
							{
								backgroundColor: c.surface,
								borderRadius: radii.xl,
								alignSelf: turn === 'Maya' ? 'flex-start' : 'flex-end'
							},
							elevation.soft
						]}
					>
						<MonoLabel>{turn}</MonoLabel>
						<Text variant="caption" tone="primary">
							{STUDENT_LINES[turn]}
						</Text>
					</Animated.View>
				) : null}
			</View>
			<View style={s.fill} pointerEvents="none" />
			<View onLayout={onSheetLayout}>
				<SheetCard>
					<Text
						variant="display"
						accessibilityRole="header"
						accessibilityLabel="Don’t just watch it. Teach it back."
					>
						Don’t just watch it. <Highlight>Teach it back.</Highlight>
					</Text>
					<Text variant="lead" tone="secondary" style={s.lead}>
						{APP_DESCRIPTION}
					</Text>
					<Button
						label="Get started"
						variant="ink"
						size="lg"
						fullWidth
						onPress={() => router.push('/(auth)/login')}
						style={s.cta}
					/>
					<Button
						label="I already have an account"
						variant="ghost"
						fullWidth
						onPress={() => router.push('/(auth)/login')}
					/>
					<Text variant="caption" tone="tertiary" style={s.legal}>
						By continuing you agree to the{' '}
						<Text
							variant="caption"
							tone="secondary"
							style={s.link}
							onPress={() => router.push('/terms')}
							accessibilityRole="link"
						>
							Terms
						</Text>{' '}
						and{' '}
						<Text
							variant="caption"
							tone="secondary"
							style={s.link}
							onPress={() => router.push('/privacy')}
							accessibilityRole="link"
						>
							Privacy Policy
						</Text>
						.
					</Text>
				</SheetCard>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 0, right: 0, zIndex: 2, gap: 14 },
	quote: { maxWidth: '82%', padding: 12, gap: 4 },
	lead: { marginTop: 12 },
	cta: { marginTop: 20 },
	legal: { textAlign: 'center', marginTop: 8 },
	link: { textDecorationLine: 'underline' }
})
