/**
 * Tabs layout — add a tab by creating app/(tabs)/<name>.tsx and a
 * <Tabs.Screen> below with its label and icon. The floating TabBar draws
 * whatever is registered here; tab screens clear it with useTabBarClearance()
 * (the Screen primitive does this when given `tabs`).
 */
import { router, Tabs } from 'expo-router'
import { Brain, CircleHelp, CircleUser, House } from 'lucide-react-native'
import TabBar from '@/components/TabBar'
import { useColors } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'

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
			{/* Quiz and Class memory are full screens with their own way back: these buttons open
			    them over the tabs, and the tab itself never shows. */}
			<Tabs.Screen
				name="quiz-tab"
				options={{
					tabBarLabel: 'Quiz',
					tabBarIcon: ({ color, size }) => (
						<CircleHelp size={size} color={color} strokeWidth={STROKE} />
					)
				}}
				listeners={{
					tabPress: (e) => {
						e.preventDefault()
						track('quiz_opened', { source: 'tab' })
						router.push('/quiz')
					}
				}}
			/>
			<Tabs.Screen
				name="memory-tab"
				options={{
					tabBarLabel: 'Class memory',
					tabBarIcon: ({ color, size }) => <Brain size={size} color={color} strokeWidth={STROKE} />
				}}
				listeners={{
					tabPress: (e) => {
						e.preventDefault()
						track('memory_opened', { source: 'tab' })
						router.push('/memory')
					}
				}}
			/>
			<Tabs.Screen name="explore" options={{ href: null }} />
			<Tabs.Screen name="activity" options={{ href: null }} />
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
