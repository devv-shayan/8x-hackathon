import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import { startBackdrop, type Backdrop } from '@app/pixel'
import type { PixelBackdropProps } from './types'

/**
 * A scene's moving pixel background, filling its parent, on the web build: a canvas running
 * the same engine as the website. It draws only while the screen is focused and the tab is
 * visible, and holds one still frame under Reduce Motion.
 */
export function PixelBackdrop({ scene, raised, style }: PixelBackdropProps) {
	const canvas = useRef<HTMLCanvasElement>(null)
	const backdrop = useRef<Backdrop | null>(null)
	const focused = useIsFocused()
	const still = useReducedMotion()
	const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
	const playing = focused && visible
	const raisedKey = JSON.stringify(raised ?? {})

	useEffect(() => {
		const onChange = () => setVisible(document.visibilityState === 'visible')
		document.addEventListener('visibilitychange', onChange)
		return () => document.removeEventListener('visibilitychange', onChange)
	}, [])

	useEffect(() => {
		if (!canvas.current) return
		backdrop.current = startBackdrop(canvas.current, {
			scene,
			raised: JSON.parse(raisedKey),
			playing,
			still
		})
		return () => backdrop.current?.stop()
		// Started once; later changes go through update() below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		backdrop.current?.update({ scene, raised: JSON.parse(raisedKey), playing, still })
	}, [scene, raisedKey, playing, still])

	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
			<canvas ref={canvas} aria-hidden style={CANVAS} />
		</View>
	)
}

const CANVAS = {
	display: 'block',
	width: '100%',
	height: '100%',
	imageRendering: 'pixelated'
} as const
