import { useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Rect } from 'react-native-svg'
import { PIXEL_FIELDS, ditherIndex } from '@app/pixel'
import { PixelText, pixelTextCell } from '@/components/dashboard/PixelCharts'
import { BrandMark } from '@/components/ui/BrandMark'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import {
	barcodeBars,
	hashOf,
	MARK_SIZE,
	personalMarkCells,
	teachingSince
} from '@/lib/personalMark'

const MARK_CELL = 12
const NAME_CELL = 6
const BARCODE_HEIGHT = 34
const BODY_PADDING = 24
/** The strap above the badge, below the status bar. */
const STRAP_LENGTH = 56
/** Just enough to look hung up rather than laid out. */
const TILT = '-1.5deg'
/** Stays in a ramp's darker half, so every cell shows on the white badge. */
const MARK_RAMP = { from: 0.08, span: 0.42 }

const MARK_PALETTES = [
	PIXEL_FIELDS.tunnel.palette,
	PIXEL_FIELDS.goldDrift.palette,
	PIXEL_FIELDS.omar.palette,
	PIXEL_FIELDS.maya.palette,
	PIXEL_FIELDS.voiceWaves.palette
] as const

/** Your own mark, drawn from your id: nobody else's looks like it, and it never changes. */
function PersonalMark({ id }: { id: string }) {
	const rects = useMemo(() => {
		const palette = MARK_PALETTES[hashOf(id) % MARK_PALETTES.length]!
		return personalMarkCells(id).flatMap((row, y) =>
			row.flatMap((lit, x) =>
				lit
					? [
							<Rect
								key={`${x}-${y}`}
								x={x * MARK_CELL}
								y={y * MARK_CELL}
								width={MARK_CELL}
								height={MARK_CELL}
								fill={
									palette[
										ditherIndex(
											MARK_RAMP.from + MARK_RAMP.span * (y / MARK_SIZE),
											x,
											y,
											palette.length
										)
									]!
								}
							/>
						]
					: []
			)
		)
	}, [id])
	return (
		<Svg width={MARK_SIZE * MARK_CELL} height={MARK_SIZE * MARK_CELL}>
			{rects}
		</Svg>
	)
}

function Barcode({ id, width, color }: { id: string; width: number; color: string }) {
	return (
		<Svg width={width} height={BARCODE_HEIGHT}>
			{barcodeBars(id, width).map((bar) => (
				<Rect key={bar.x} x={bar.x} y={0} width={bar.width} height={BARCODE_HEIGHT} fill={color} />
			))}
		</Svg>
	)
}

/** The first name in pixel letters; in plain type when the font can't draw it. */
function BadgeName({ name, width }: { name: string; width: number }) {
	const { colors: c } = useTheme()
	const first = name.trim().split(/\s+/)[0] ?? name
	const letters = first.toUpperCase()
	const cell = pixelTextCell(letters, width, NAME_CELL)
	return cell === null ? (
		<Text variant="h2" numberOfLines={1} style={s.name}>
			{first}
		</Text>
	) : (
		<View style={s.name}>
			<PixelText text={letters} cell={cell} color={c.textPrimary} />
		</View>
	)
}

/**
 * The person as this app knows them: a teacher's ID on a lanyard, with Maya and Omar as students.
 * `children` stands in for the details while they load, or for the error when they don't.
 */
export function TeacherBadge({
	id,
	name,
	email,
	createdAt,
	children
}: {
	id?: string
	name?: string
	email?: string
	createdAt?: string | null
	children?: ReactNode
}) {
	const { colors: c, radii } = useTheme()
	const insets = useSafeAreaInsets()
	const [bodyWidth, setBodyWidth] = useState(0)
	const since = teachingSince(createdAt)
	const inner = Math.max(0, bodyWidth - BODY_PADDING * 2)
	const onLayout = (e: LayoutChangeEvent) => setBodyWidth(Math.floor(e.nativeEvent.layout.width))
	return (
		<View style={s.wrap}>
			<View style={[s.lanyard, { height: insets.top + STRAP_LENGTH }]}>
				<View style={[s.strap, { backgroundColor: c.hero }]} />
				<View style={[s.strap, { backgroundColor: c.hero }]} />
			</View>
			<View style={[s.clip, { backgroundColor: c.hero }]} />
			<View
				accessible
				accessibilityLabel={
					name
						? `Teacher badge. ${name}, ${email}. Students: Maya and Omar.${since ? ` Teaching since ${since}.` : ''}`
						: undefined
				}
				onLayout={onLayout}
				style={[s.badge, { backgroundColor: c.surface, borderRadius: radii['3xl'] }]}
			>
				<View style={[s.head, { backgroundColor: c.hero }]}>
					<View style={[s.slot, { backgroundColor: c.surface3 }]} />
					<BrandMark light />
					<Text variant="eyebrow" style={{ color: c.brandFill }}>
						Teacher
					</Text>
				</View>
				<View style={s.body}>
					{id && name ? (
						<>
							<PersonalMark id={id} />
							<BadgeName name={name} width={inner} />
							<Text variant="caption" tone="secondary" numberOfLines={1}>
								{email}
							</Text>
							<View style={[s.rule, { backgroundColor: c.surface3 }]} />
							<View style={s.fields}>
								<View style={s.field}>
									<Text variant="eyebrow" tone="secondary">
										Students
									</Text>
									<Text variant="label">Maya, Omar</Text>
								</View>
								{since ? (
									<View style={[s.field, s.fieldRight]}>
										<Text variant="eyebrow" tone="secondary">
											Teaching since
										</Text>
										<Text variant="label">{since}</Text>
									</View>
								) : null}
							</View>
							{inner ? (
								<View style={s.barcode}>
									<Barcode id={id} width={inner} color={c.textPrimary} />
								</View>
							) : null}
						</>
					) : (
						children
					)}
				</View>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { alignItems: 'center' },
	lanyard: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
	strap: { width: 14, height: '100%' },
	clip: { width: 40, height: 18, borderRadius: 4, zIndex: 2, marginTop: -2 },
	badge: { width: '82%', overflow: 'hidden', marginTop: -6, transform: [{ rotate: TILT }] },
	head: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingTop: 30,
		paddingBottom: 14
	},
	slot: {
		position: 'absolute',
		top: 10,
		alignSelf: 'center',
		left: '50%',
		marginLeft: -22,
		width: 44,
		height: 8,
		borderRadius: 4
	},
	body: { alignItems: 'center', padding: BODY_PADDING, gap: 6, minHeight: 120 },
	name: { marginTop: 14 },
	rule: { height: 2, alignSelf: 'stretch', marginVertical: 12 },
	fields: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
	field: { gap: 2 },
	fieldRight: { alignItems: 'flex-end' },
	barcode: { marginTop: 16 }
})
