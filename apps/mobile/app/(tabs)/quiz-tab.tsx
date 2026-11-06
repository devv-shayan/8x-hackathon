import { Redirect } from 'expo-router'

/** The tab bar's Quiz button opens the full-screen quiz (the tab's listener in _layout). */
export default function QuizTab() {
	return <Redirect href="/quiz" />
}
