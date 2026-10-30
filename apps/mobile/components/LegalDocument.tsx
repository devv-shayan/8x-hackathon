import { StyleSheet, View } from 'react-native'
import { PageHeader, ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'

export interface LegalSection {
	heading: string
	body: string
}

/**
 * A legal page (terms, privacy) set for reading: a comfortable measure,
 * generous leading, headings in the display face.
 */
export function LegalDocument({
	title,
	updated,
	sections
}: {
	title: string
	updated: string
	sections: LegalSection[]
}) {
	return (
		<Screen header={<PageHeader />} gap={24}>
			<ScreenTitle title={title} subtitle={`Last updated ${updated}`} />
			{sections.map((section) => (
				<View key={section.heading} style={s.section}>
					<Text variant="h3" accessibilityRole="header">
						{section.heading}
					</Text>
					<Text variant="body" tone="body" style={s.body}>
						{section.body}
					</Text>
				</View>
			))}
		</Screen>
	)
}

const s = StyleSheet.create({
	section: { gap: 8, maxWidth: 640 },
	body: { lineHeight: 26 }
})
