import { type StyleProp } from 'react-native'
import { Image, type ImageStyle } from 'expo-image'

const FACES = {
	Maya: require('@/assets/students/maya.png'),
	Omar: require('@/assets/students/omar.png')
} as const

export type Student = keyof typeof FACES

/**
 * A student's pixel portrait, as a plain image: light enough for every row of a list, where a
 * live scene per row would not be. `npm run build:portraits` draws them from the pixel engine.
 */
export function StudentFace({
	student,
	size,
	radius,
	style
}: {
	student: Student
	size: number
	radius: number
	style?: StyleProp<ImageStyle>
}) {
	return (
		<Image
			source={FACES[student]}
			accessibilityLabel={student}
			accessibilityIgnoresInvertColors
			contentFit="cover"
			style={[{ width: size, height: size, borderRadius: radius }, style]}
		/>
	)
}
