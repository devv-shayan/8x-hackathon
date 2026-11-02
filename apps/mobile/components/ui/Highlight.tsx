import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import { useColors } from '@/contexts/ThemeContext'

/**
 * One word in lime, as the website marks the word that matters ("Teach it back"). Use it
 * inside a Text, never on its own: it inherits the line's face and size, and only adds the
 * fill. One per heading at most, and only on the word that carries the meaning.
 */
export function Highlight({ children }: { children: ReactNode }) {
	const c = useColors()
	return <RNText style={{ backgroundColor: c.brandFill, color: c.onBrand }}>{children}</RNText>
}
