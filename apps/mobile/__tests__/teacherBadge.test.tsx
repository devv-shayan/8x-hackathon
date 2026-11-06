/**
 * The Profile tab's badge: what it says about the person, and what it does with a name the pixel
 * font can't draw.
 */
import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { pixelTextCell } from '@/components/dashboard/PixelCharts'
import { TeacherBadge } from '@/components/profile/TeacherBadge'

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))

const ID = '00000000-0000-4000-8000-000000000001'

it('says who they are, who they teach and since when', () => {
	render(
		<TeacherBadge
			id={ID}
			name="Sam Rivera"
			email="sam@example.test"
			createdAt="2026-10-30T10:00:00.000Z"
		/>
	)
	expect(screen.getByText('sam@example.test')).toBeTruthy()
	expect(screen.getByText('Maya, Omar')).toBeTruthy()
	expect(screen.getByText('Teaching since')).toBeTruthy()
})

it('leaves out the date for an account without one', () => {
	render(<TeacherBadge id={ID} name="Sam" email="sam@example.test" createdAt={null} />)
	expect(screen.queryByText('Teaching since')).toBeNull()
})

it('writes a name in plain type when the font has no letters for it', () => {
	render(<TeacherBadge id={ID} name="شايان خان" email="a@example.test" createdAt={null} />)
	expect(screen.getByText('شايان')).toBeTruthy()
})

it('shows what it is given while the details are away', () => {
	render(
		<TeacherBadge>
			<Text>Loading</Text>
		</TeacherBadge>
	)
	expect(screen.getByText('Loading')).toBeTruthy()
	expect(screen.queryByText('Maya, Omar')).toBeNull()
})

it('draws only what the font has, at a size that stays legible', () => {
	expect(pixelTextCell('SAM', 280, 6)).toBe(6)
	expect(pixelTextCell('MÜLLER', 280, 6)).toBeNull()
	expect(pixelTextCell('A'.repeat(40), 280, 6)).toBeNull()
})
