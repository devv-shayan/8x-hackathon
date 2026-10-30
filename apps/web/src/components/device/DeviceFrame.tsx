import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * A neutral phone at the real iPhone aspect (393 × 852 pt), in the preset's
 * own bezel colour. By default it shows an app screen rendered in HTML from
 * the same brand tokens as the app, so it rebrands with the preset and the
 * accent. Pass `src` (a real screenshot at 1179 × 2556) to show the play's
 * actual app instead.
 *
 * Size it with `--screen`, the screen width in px as a plain number, e.g.
 * `className="[--screen:300] lg:[--screen:330]"`.
 */
export function DeviceFrame({
	label,
	src,
	isPriority = false,
	isDecorative = false,
	className,
	children
}: {
	/** What the screen shows, for screen readers. */
	label: string
	/** 🎨 REPLACE: a real screenshot, once the play has one. */
	src?: string
	/** Set on the one screenshot that is the page's largest first paint. */
	isPriority?: boolean
	/** A phone that is scenery (a second phone in the background): hidden from screen readers. */
	isDecorative?: boolean
	className?: string
	children?: React.ReactNode
}) {
	return (
		<div
			{...(isDecorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
			className={cn('device', className)}
		>
			<div className="device-screen">
				{src ? (
					<Image
						src={src}
						alt=""
						fill
						priority={isPriority}
						sizes="(min-width: 1280px) 340px, (min-width: 640px) 300px, 260px"
						className="object-cover"
					/>
				) : (
					<div className="device-canvas">{children}</div>
				)}
				{/* The Dynamic Island, placed in % of the screen so it sits right over a screenshot too. */}
				<span
					aria-hidden="true"
					className="absolute left-1/2 top-[1.3%] z-10 h-[4.35%] w-[31.8%] -translate-x-1/2 rounded-pill bg-[var(--device-bezel)]"
				/>
				{/* Glass: a faint top-lit sheen across the display. */}
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-line-glass/60 via-transparent to-transparent opacity-60"
				/>
			</div>
		</div>
	)
}
