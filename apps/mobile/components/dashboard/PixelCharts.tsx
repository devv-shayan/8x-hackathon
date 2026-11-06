import { useState, type ReactNode } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import { BAYER_4, ditherIndex } from '@app/pixel'

// The dashboard's charts, drawn in cells and dithered with the backdrops' own engine and palettes,
// so they read as part of the same picture rather than a chart library's.

export type Palette = readonly string[]

const bayer = (x: number, y: number) => BAYER_4[(y & 3) * 4 + (x & 3)]!
/** A colour from a ramp at `v` 0..1, dithered at cell (x, y). */
const tone = (palette: Palette, v: number, x: number, y: number) =>
	palette[ditherIndex(v, x, y, palette.length)]!

const GLYPHS: Record<string, string[]> = {
	'0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
	'1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
	'2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
	'3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
	'4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
	'5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
	'6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
	'7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
	'8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
	'9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
	'%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
	'/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
	'-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
	A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
	B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
	C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
	D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
	E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
	F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
	G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
	H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
	I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
	J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
	K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
	L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
	M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
	N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
	O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
	P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
	Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
	R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
	S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
	T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
	U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
	V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
	W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
	X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
	Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
	Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
	"'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000']
}
const SMALLEST_LEGIBLE_CELL = 3
const BLANK = ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
const GLYPH_WIDTH = 5
const GLYPH_HEIGHT = 7

/**
 * The cell size that draws `text` within `maxWidth`, or null when it can't: a character outside
 * the font (most of the world's names), or too long to stay legible.
 */
export function pixelTextCell(text: string, maxWidth: number, largest: number) {
	if (![...text].every((char) => char in GLYPHS)) return null
	const cell = Math.min(largest, Math.floor(maxWidth / (text.length * (GLYPH_WIDTH + 1) - 1)))
	return cell >= SMALLEST_LEGIBLE_CELL ? cell : null
}

/** Numbers and capitals in a 5x7 pixel font. `off` draws the unlit cells too, like lamps. */
export function PixelText({
	text,
	cell,
	color,
	off
}: {
	text: string
	cell: number
	color: string
	off?: string
}) {
	const chars = text.split('')
	const rects: ReactNode[] = []
	const step = GLYPH_WIDTH + 1
	chars.forEach((char, i) => {
		const glyph = GLYPHS[char] ?? BLANK
		for (let y = 0; y < GLYPH_HEIGHT; y++)
			for (let x = 0; x < step; x++) {
				if (x === GLYPH_WIDTH && i === chars.length - 1) continue
				const lit = x < GLYPH_WIDTH && glyph[y]![x] === '1'
				if (!lit && !off) continue
				const size = off ? cell - 2 : cell
				rects.push(
					<Rect
						key={`${i}-${x}-${y}`}
						x={(i * step + x) * cell}
						y={y * cell}
						width={size}
						height={size}
						fill={lit ? color : off}
					/>
				)
			}
	})
	return (
		<Svg width={(chars.length * step - 1) * cell} height={GLYPH_HEIGHT * cell}>
			{rects}
		</Svg>
	)
}

/** Measures its own width, for charts that fill a card. */
function useWidth() {
	const [width, setWidth] = useState(0)
	const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width))
	return [width, onLayout] as const
}

/**
 * Columns of cells, each filled from the bottom to `value` 0..1 through a dithered ramp, the top
 * row dissolving by its fraction. Unfilled cells are a faint dot grid.
 */
export function PixelColumns({
	values,
	rows,
	cell,
	palette,
	track,
	gap = 1,
	ramp = [0.05, 0.6],
	highlight
}: {
	values: readonly number[]
	rows: number
	cell: number
	palette: Palette
	track: string
	/** Empty cells between columns. */
	gap?: number
	ramp?: readonly [number, number]
	/** A column drawn from the top of `palette`, for the one that matters most. */
	highlight?: number
}) {
	const [width, onLayout] = useWidth()
	const [low, high] = ramp
	const per = values.length
		? Math.max(1, Math.floor((width / cell - (values.length - 1) * gap) / values.length))
		: 0
	const rects: ReactNode[] = []
	values.forEach((value, i) => {
		const height = value * rows
		const whole = Math.floor(height)
		for (let col = 0; col < per; col++) {
			const x = i * (per + gap) + col
			for (let r = 0; r < rows; r++) {
				const y = rows - 1 - r
				const filled = r < whole || (r === whole && bayer(x, y) < height - whole)
				const v = highlight === i ? 0.55 + 0.45 * (r / rows) : low + (high - low) * (r / rows)
				rects.push(
					filled ? (
						<Rect
							key={`${x}-${y}`}
							x={x * cell}
							y={y * cell}
							width={cell}
							height={cell}
							fill={tone(palette, v, x, y)}
						/>
					) : (
						<Rect
							key={`${x}-${y}`}
							x={x * cell + cell / 2 - 1}
							y={y * cell + cell / 2 - 1}
							width={2}
							height={2}
							fill={track}
						/>
					)
				)
			}
		}
	})
	return (
		<View onLayout={onLayout} style={{ height: rows * cell }}>
			{width ? (
				<Svg width={width} height={rows * cell}>
					{rects}
				</Svg>
			) : null}
		</View>
	)
}

/** A day as a tile of 4x4 cells: more ink the more you did, a flat tile when you did nothing. */
export function DensityTile({
	count,
	cell,
	ink,
	lit,
	empty
}: {
	count: number
	cell: number
	ink: string
	lit: string
	empty: string
}) {
	const density = count === 1 ? 0.3 : count === 2 ? 0.62 : 1
	const rects: ReactNode[] = []
	for (let y = 0; y < 4; y++)
		for (let x = 0; x < 4; x++)
			rects.push(
				<Rect
					key={`${x}-${y}`}
					x={x * cell}
					y={y * cell}
					width={cell - 0.5}
					height={cell - 0.5}
					fill={count === 0 ? empty : bayer(x, y) < density ? ink : lit}
				/>
			)
	return (
		<Svg width={cell * 4} height={cell * 4}>
			{rects}
		</Svg>
	)
}

/** A horizontal bar of cells, dithered along its length, dissolving at its end. */
export function PixelRow({
	value,
	cell,
	rows,
	palette,
	track
}: {
	value: number
	cell: number
	rows: number
	palette: Palette
	track: string
}) {
	const [width, onLayout] = useWidth()
	const cols = Math.floor(width / cell)
	const fill = value * cols
	const rects: ReactNode[] = []
	for (let x = 0; x < cols; x++)
		for (let y = 0; y < rows; y++) {
			const whole = Math.floor(fill)
			const filled = x < whole || (x === whole && bayer(x, y) < fill - whole)
			rects.push(
				filled ? (
					<Rect
						key={`${x}-${y}`}
						x={x * cell}
						y={y * cell}
						width={cell}
						height={cell}
						fill={tone(palette, 0.08 + 0.5 * (x / Math.max(1, cols)), x, y)}
					/>
				) : (
					<Rect
						key={`${x}-${y}`}
						x={x * cell + cell / 2 - 1}
						y={y * cell + cell / 2 - 1}
						width={2}
						height={2}
						fill={track}
					/>
				)
			)
		}
	return (
		<View onLayout={onLayout} style={{ height: rows * cell }}>
			{width ? (
				<Svg width={width} height={rows * cell}>
					{rects}
				</Svg>
			) : null}
		</View>
	)
}
