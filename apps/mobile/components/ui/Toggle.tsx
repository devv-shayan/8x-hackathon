import { Platform, Switch } from 'react-native'
import { useColors } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'

/**
 * The platform switch, in the palette: the accent fill when on, the neutral
 * track when off, and a selection tick on change.
 */
export function Toggle({
	value,
	onValueChange,
	disabled,
	accessibilityLabel
}: {
	value: boolean
	onValueChange: (next: boolean) => void
	disabled?: boolean
	accessibilityLabel: string
}) {
	const c = useColors()
	return (
		<Switch
			value={value}
			disabled={disabled}
			accessibilityLabel={accessibilityLabel}
			onValueChange={(next) => {
				haptic.select()
				onValueChange(next)
			}}
			trackColor={{ false: c.surface3, true: c.brandFill }}
			thumbColor={Platform.OS === 'android' ? (value ? c.onBrand : c.textSecondary) : undefined}
			ios_backgroundColor={c.surface3}
		/>
	)
}
