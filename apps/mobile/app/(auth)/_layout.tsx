import { Stack } from 'expo-router'
import { useColors } from '@/contexts/ThemeContext'

export default function AuthLayout() {
	const c = useColors()
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				animation: 'slide_from_right',
				contentStyle: { backgroundColor: c.bg }
			}}
		>
			<Stack.Screen name="login" />
		</Stack>
	)
}
