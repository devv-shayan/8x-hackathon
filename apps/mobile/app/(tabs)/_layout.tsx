/**
 * Tabs layout — add a tab by creating app/(tabs)/<name>.tsx and a
 * <Tabs.Screen> below with its label and icon. The floating TabBar draws
 * whatever is registered here; tab screens clear it with useTabBarClearance()
 * (the Screen primitive does this when given `tabs`).
 */
import { Tabs } from 'expo-router'
import { Bell, CircleUser, Compass, House } from 'lucide-react-native'
import TabBar from '@/components/TabBar'
import { useColors } from '@/contexts/ThemeContext'

const STROKE = 1.9

export default function TabsLayout() {
	const c = useColors()
	return (
		<Tabs
			tabBar={(props) => <TabBar {...props} />}
			screenOptions={{
				headerShown: false,
				sceneStyle: { backgroundColor: c.bg },
				animation: 'fade',
				freezeOnBlur: true
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					tabBarLabel: 'Home',
					tabBarIcon: ({ color, size }) => <House size={size} color={color} strokeWidth={STROKE} />
				}}
			/>
			<Tabs.Screen
				name="explore"
				options={{
					tabBarLabel: 'Explore',
					tabBarIcon: ({ color, size }) => (
						<Compass size={size} color={color} strokeWidth={STROKE} />
					)
				}}
			/>
			<Tabs.Screen
				name="activity"
				options={{
					tabBarLabel: 'Activity',
					tabBarIcon: ({ color, size }) => <Bell size={size} color={color} strokeWidth={STROKE} />
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					tabBarLabel: 'Profile',
					tabBarIcon: ({ color, size }) => (
						<CircleUser size={size} color={color} strokeWidth={STROKE} />
					)
				}}
			/>
		</Tabs>
	)
}
