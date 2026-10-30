import { ImageResponse } from 'next/og'
import { brandConfig, palette } from '@app/brand'

// The favicon, drawn from the brand: the accent fill with the site's initial
// in its AA text colour. Rebrands with packages/brand/brand.config.ts; replace
// with a real mark (app/icon.png or icon.svg) once the play has one.

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
	const p = palette()
	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: p.brandFill,
				color: p.onBrand,
				borderRadius: 16,
				fontSize: 38,
				fontWeight: 800
			}}
		>
			{brandConfig.siteName.charAt(0).toUpperCase()}
		</div>,
		size
	)
}
