import { Stack } from 'expo-router'
import { useColors } from '@/contexts/ThemeContext'

export default function OnboardingLayout() {
	const c = useColors()
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				// The shell moves between steps itself; gestures would skip past them.
				gestureEnabled: false,
				animation: 'fade',
				contentStyle: { backgroundColor: c.bg }
			}}
		>
			<Stack.Screen name="index" />
		</Stack>
	)
}
