import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { startBoard, type Board } from '@app/pixel'
import { useReducedMotion } from '@/lib/motion'
import type { PixelBoardProps } from './PixelBoard'

/**
 * The class's board while a video reads, on the web build: a canvas running the engine's board
 * directly (8X-49). It draws only while the screen is focused and the tab is visible.
 */
export function PixelBoard({ src, progress, ready, style }: PixelBoardProps) {
	const canvas = useRef<HTMLCanvasElement>(null)
	const board = useRef<Board | null>(null)
	const focused = useIsFocused()
	const still = useReducedMotion()
	const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
	const playing = focused && visible

	useEffect(() => {
		const onChange = () => setVisible(document.visibilityState === 'visible')
		document.addEventListener('visibilitychange', onChange)
		return () => document.removeEventListener('visibilitychange', onChange)
	}, [])

	useEffect(() => {
		if (!canvas.current) return
		board.current = startBoard(canvas.current, { src, progress, ready, playing, still })
		return () => board.current?.stop()
		// Started once; later changes go through update() below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		board.current?.update({ src, progress, ready, playing, still })
	}, [src, progress, ready, playing, still])

	return (
		<View pointerEvents="none" style={[s.fill, style]}>
			<canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
		</View>
	)
}

const s = StyleSheet.create({ fill: { flex: 1 } })
