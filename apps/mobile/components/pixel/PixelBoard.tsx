import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useIsFocused } from 'expo-router'
import { WebView } from 'react-native-webview'
import { BACKDROP_HTML } from '@app/pixel/backdrop-html'
import { useReducedMotion } from '@/lib/motion'

export type PixelBoardProps = {
	/** The thumbnail to reveal. */
	src: string
	/** How far the read has got, 0 to 1. */
	progress: number
	/** The video is read: the real picture. */
	ready: boolean
	style?: StyleProp<ViewStyle>
}

/**
 * The class's board while a video reads, on iOS and Android: the engine's page in a transparent
 * WebView, drawing the thumbnail in the app's pixel pattern from its own main colour (8X-49).
 * Touches pass through.
 */
export function PixelBoard({ src, progress, ready, style }: PixelBoardProps) {
	const web = useRef<WebView>(null)
	const focused = useIsFocused()
	const still = useReducedMotion()
	const [loaded, setLoaded] = useState(false)
	const state = JSON.stringify({ board: src, progress, ready, playing: focused, still })
	const initial = useRef(state).current
	const latest = useRef(state)
	latest.current = state

	useEffect(() => {
		web.current?.injectJavaScript(`window.__backdrop&&window.__backdrop(${state});true;`)
	}, [state])

	return (
		<View pointerEvents="none" style={[s.fill, style]}>
			<View style={[s.fill, { opacity: loaded ? 1 : 0 }]}>
				<WebView
					ref={web}
					originWhitelist={['*']}
					source={{ html: BACKDROP_HTML }}
					injectedJavaScriptBeforeContentLoaded={`window.__initial=${initial};true;`}
					onLoadEnd={() => {
						// A change made while the page loaded never reached it: send the latest.
						web.current?.injectJavaScript(
							`window.__backdrop&&window.__backdrop(${latest.current});true;`
						)
						setLoaded(true)
					}}
					scrollEnabled={false}
					bounces={false}
					overScrollMode="never"
					showsVerticalScrollIndicator={false}
					showsHorizontalScrollIndicator={false}
					setSupportMultipleWindows={false}
					javaScriptEnabled
					androidLayerType="hardware"
					style={s.web}
				/>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	web: { flex: 1, backgroundColor: 'transparent' }
})
