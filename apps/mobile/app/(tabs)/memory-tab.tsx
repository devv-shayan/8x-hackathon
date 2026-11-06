import { Redirect } from 'expo-router'

/** The tab bar's Class memory button opens the full-screen board (the tab's listener in _layout). */
export default function MemoryTab() {
	return <Redirect href="/memory" />
}
