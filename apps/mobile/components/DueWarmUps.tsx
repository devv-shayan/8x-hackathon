import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight } from 'lucide-react-native'
import type { DueWarmUp } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { QueryErrorState } from '@/components/QueryError'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useDueWarmUps } from '@/hooks/useWarmUps'
import { track } from '@/lib/analytics'

/** Opens a warm-up on its own screen. */
export function openWarmUp(gap: DueWarmUp) {
	router.push(`/warm-up/${gap.gap_id}`)
}

/**
 * Home's warm-up: the first due gap as one card, with who has a question, that opens the
 * warm-up screen. One at a time, oldest first; the count says how many more wait.
 */
export function DueWarmUps() {
	const { colors: c, radii } = useTheme()
	const due = useDueWarmUps()
	const first = due.data?.[0]
	const firstId = first?.gap_id

	useEffect(() => {
		if (firstId) track('warm_up_offered', { gap_id: firstId })
	}, [firstId])

	if (due.isPending) return <CardSkeleton height={76} />
	if (due.isError) {
		return (
			<QueryErrorState
				error={due.error}
				title="Couldn't load warm-ups"
				onRetry={() => {
					void due.refetch()
				}}
			/>
		)
	}

	const count = due.data.length
	if (!first) {
		return (
			<View style={s.section}>
				<MonoLabel>Warm-ups</MonoLabel>
				<Text variant="bodySm" tone="secondary">
					Nothing due. A warm-up comes a couple of days after you miss an idea in class.
				</Text>
			</View>
		)
	}

	const student = first.student_name ?? first.open_warm_up?.student_name ?? 'A student'
	return (
		<View style={s.section}>
			<MonoLabel right={count === 1 ? '1 warm-up' : `${count} warm-ups`}>Due today</MonoLabel>
			<PressableScale
				scaleTo="card"
				onPress={() => openWarmUp(first)}
				accessibilityRole="button"
				accessibilityLabel={`${student} has a question about ${first.concept_title}`}
				style={[s.card, { backgroundColor: c.well, borderRadius: radii['3xl'] }]}
			>
				<View style={[s.portrait, { borderRadius: radii.xl }]}>
					<PixelBackdrop scene={student === 'Omar' ? 'omarCard' : 'mayaCard'} />
				</View>
				<View style={s.copy}>
					<Text variant="h3">{`${student} has a question`}</Text>
					<Text variant="caption" tone="secondary" numberOfLines={2}>
						{`About ${first.concept_title}, from ${first.topic_title}`}
					</Text>
				</View>
				<View style={[s.go, { backgroundColor: c.textPrimary }]}>
					<ArrowRight size={18} color={c.brandFill} strokeWidth={2.4} />
				</View>
			</PressableScale>
		</View>
	)
}

const s = StyleSheet.create({
	section: { gap: 12 },
	card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14 },
	portrait: { width: 56, height: 56, overflow: 'hidden' },
	copy: { flex: 1, gap: 2 },
	go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
})
