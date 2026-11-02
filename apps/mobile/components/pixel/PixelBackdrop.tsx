import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import { WebView } from 'react-native-webview'
import { BACKDROP_HTML } from '@app/pixel/backdrop-html'
import type { PixelBackdropProps } from './types'

/**
 * A scene's moving pixel background, filling its parent, on iOS and Android: a transparent
 * WebView running the same engine as the web build and the website, so it ships in an update
 * with no native code of its own. Touches pass through to the screen. It stays hidden until
 * the page has loaded, so there's no white flash, and pauses when the screen isn't focused.
 */
export function PixelBackdrop({ scene, raised, style }: PixelBackdropProps) {
	const web = useRef<WebView>(null)
	const focused = useIsFocused()
	const still = useReducedMotion()
	const [loaded, setLoaded] = useState(false)
	const raisedKey = JSON.stringify(raised ?? {})
	const state = JSON.stringify({ scene, raised: JSON.parse(raisedKey), playing: focused, still })
	const initial = useRef(state).current

	useEffect(() => {
		web.current?.injectJavaScript(`window.__backdrop&&window.__backdrop(${state});true;`)
	}, [state])

	return (
		<View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
			<View style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}>
				<WebView
					ref={web}
					originWhitelist={['*']}
					source={{ html: BACKDROP_HTML }}
					injectedJavaScriptBeforeContentLoaded={`window.__initial=${initial};true;`}
					onLoadEnd={() => setLoaded(true)}
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

const s = StyleSheet.create({ web: { flex: 1, backgroundColor: 'transparent' } })
