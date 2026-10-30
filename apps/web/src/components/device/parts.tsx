import type { CSSProperties } from 'react'
import { ArrowRight, Bell, CircleUser, Compass, House } from 'lucide-react'
import { brandConfig, theme, type TypeRole } from '@app/brand'
import { cn } from '@/lib/utils'

/*
 * The building blocks of the HTML app screens, drawn after the app's own
 * primitives in apps/mobile/components (Eyebrow, Button, Card, StatusBadge,
 * ProgressBar, SelectionRow, TabBar, LogoMark). Everything is laid out in the
 * app's points (a 393 × 852 canvas that DeviceFrame scales), and every size,
 * weight and tracking comes from the preset's role scale, the one the Expo app
 * reads, so the phone on the website is the app, not a drawing of it.
 *
 * When an app primitive changes shape, change its twin here.
 */

/** Inline style for one role of the brand type scale, at app size. */
export function type(role: TypeRole): CSSProperties {
	const spec = theme.type[role]
	return {
		fontFamily: `var(--font-${spec.family})`,
		fontWeight: spec.weight,
		fontSize: spec.size,
		lineHeight: `${spec.lineHeight}px`,
		letterSpacing: `${spec.tracking}em`,
		...(spec.uppercase && { textTransform: 'uppercase' }),
		...(spec.tabular && { fontVariantNumeric: 'tabular-nums' })
	}
}

/** Screen side padding, pt (layout.gutter and layout.gutterWide in the brand). */
export const GUTTER = 20
export const GUTTER_WIDE = 24
/** The iPhone status bar and home-indicator insets, pt. */
export const INSET_TOP = 59
export const INSET_BOTTOM = 34

/** The iOS status bar: time, and signal / Wi-Fi / battery drawn in currentColor. */
export function StatusBar() {
	return (
		<div className="absolute inset-x-0 top-0 z-20 flex h-[54px] items-center justify-between px-[34px] pt-[6px] text-ink">
			<span style={{ fontFamily: 'var(--font-text)', fontWeight: 600, fontSize: 17 }}>9:41</span>
			<span className="flex items-center gap-[6px]">
				<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
					<rect x="0" y="8" width="3" height="4" rx="1" />
					<rect x="5" y="5.5" width="3" height="6.5" rx="1" />
					<rect x="10" y="3" width="3" height="9" rx="1" />
					<rect x="15" y="0" width="3" height="12" rx="1" />
				</svg>
				<svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
					<path d="M8 2.3c2.2 0 4.2.9 5.7 2.3l1.1-1.1A9.6 9.6 0 0 0 8 .7 9.6 9.6 0 0 0 1.2 3.5l1.1 1.1A8 8 0 0 1 8 2.3Zm0 3.2c1.4 0 2.6.5 3.5 1.4l1.1-1.1A6.5 6.5 0 0 0 8 3.9a6.5 6.5 0 0 0-4.6 1.9l1.1 1.1c.9-.9 2.1-1.4 3.5-1.4Zm0 3.2c-.6 0-1.1.2-1.4.6L8 10.7l1.4-1.4c-.3-.4-.8-.6-1.4-.6Z" />
				</svg>
				<svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden="true">
					<rect
						x="0.5"
						y="0.5"
						width="22"
						height="12"
						rx="3.5"
						stroke="currentColor"
						opacity="0.4"
					/>
					<rect x="2" y="2" width="19" height="9" rx="2.2" fill="currentColor" />
					<path
						d="M24 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z"
						fill="currentColor"
						opacity="0.4"
					/>
				</svg>
			</span>
		</div>
	)
}

/** The home indicator bar. */
export function HomeIndicator() {
	return (
		<span className="absolute bottom-[8px] left-1/2 z-20 h-[5px] w-[134px] -translate-x-1/2 rounded-pill bg-ink" />
	)
}

/** A soft radial wash of the accent (Glow in the app): atmosphere, never a halo. */
export function Glow({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn('absolute rounded-full', className)}
			style={{
				background:
					'radial-gradient(closest-side, rgb(var(--c-brand-glow) / var(--c-brand-glow-a, 1)), rgb(var(--c-brand-glow) / calc(var(--c-brand-glow-a, 1) * 0.35)) 55%, rgb(var(--c-brand-glow) / 0))'
			}}
		/>
	)
}

/** Three dots and a tracked caps line (Eyebrow in the app). */
export function Eyebrow({
	children,
	tone = 'brand'
}: {
	children: string
	tone?: 'brand' | 'muted'
}) {
	const color = tone === 'brand' ? 'bg-brand-ink' : 'bg-ink-tertiary'
	return (
		<span
			className={cn(
				'flex items-center gap-[8px]',
				tone === 'brand' ? 'text-brand-ink' : 'text-ink-tertiary'
			)}
		>
			<span className="flex gap-[3px]">
				<span className={cn('h-[3px] w-[3px] rounded-full opacity-55', color)} />
				<span className={cn('h-[3px] w-[3px] rounded-full', color)} />
				<span className={cn('h-[3px] w-[3px] rounded-full opacity-55', color)} />
			</span>
			<span style={type('eyebrow')}>{children}</span>
		</span>
	)
}

/** The app's mark (LogoMark): the brand gradient with the name's initial. 🎨 REPLACE with the real icon. */
export function AppMark({ size = 40 }: { size?: number }) {
	return (
		<span
			className="grid place-items-center bg-gradient-to-br from-brand-from to-brand-to text-on-brand shadow-soft"
			style={{
				width: size,
				height: size,
				borderRadius: size * 0.3,
				fontFamily: 'var(--font-display)',
				fontWeight: theme.type.h3.weight,
				fontSize: size * 0.46,
				lineHeight: 1
			}}
		>
			{brandConfig.appName.charAt(0).toUpperCase()}
		</span>
	)
}

/** Button height by size, and the arrow disc on large primary buttons, pt. */
const BUTTON_HEIGHT = { sm: 40, md: 50, lg: 56 } as const
const ARROW = 40

/**
 * The app's Button: primary is the brand gradient with the AA text colour; the
 * large primary carries an arrow disc on its trailing edge. Corners follow the
 * preset (a pill on dusk, a rounded rectangle on daylight), capped at half the
 * height as in the app.
 */
export function AppButton({
	children,
	variant = 'primary',
	size = 'lg',
	withArrow = false
}: {
	children: string
	variant?: 'primary' | 'ghost'
	size?: keyof typeof BUTTON_HEIGHT
	withArrow?: boolean
}) {
	const height = BUTTON_HEIGHT[size]
	const radius = `min(var(--radius-button), ${height / 2}px)`
	const hasArrow = withArrow && size === 'lg' && variant === 'primary'
	return (
		<span
			className={cn(
				'relative flex w-full items-center',
				hasArrow ? 'justify-between pl-[28px] pr-[8px]' : 'justify-center',
				variant === 'primary'
					? 'bg-gradient-to-br from-brand-from to-brand-to text-on-brand shadow-cta'
					: 'text-ink-secondary'
			)}
			style={{ height, borderRadius: radius, ...type('label'), fontSize: size === 'lg' ? 16 : 15 }}
		>
			{children}
			{hasArrow && (
				<span
					className="grid place-items-center rounded-full bg-on-brand text-brand"
					style={{ width: ARROW, height: ARROW }}
				>
					<ArrowRight size={18} strokeWidth={2.2} />
				</span>
			)}
		</span>
	)
}

/** A card tier (Card in the app): standard, well, selected or hero. */
export function AppCard({
	tier = 'standard',
	padding = 18,
	className,
	children
}: {
	tier?: 'standard' | 'well' | 'selected' | 'hero'
	padding?: number
	className?: string
	children: React.ReactNode
}) {
	return (
		<div
			className={cn(
				'rounded-card border',
				{
					standard: 'border-line-hairline bg-surface',
					well: 'border-transparent bg-well',
					selected: 'border-brand-border bg-brand-dim',
					hero: 'border-hero-border bg-hero text-hero-text shadow-raised'
				}[tier],
				className
			)}
			style={{ padding }}
		>
			{children}
		</div>
	)
}

/** A determinate progress bar (ProgressBar): the track and the accent ink filling it. */
export function ProgressBar({ value }: { value: number }) {
	return (
		<span className="block h-[6px] overflow-hidden rounded-pill bg-tint-track">
			<span
				className="block h-full rounded-pill bg-brand-ink"
				style={{ width: `${value * 100}%` }}
			/>
		</span>
	)
}

/** A status chip (StatusBadge): the semantic soft fill, its AA text and a dot. */
export function StatusBadge({ status }: { status: 'active' | 'pending' | 'archived' }) {
	const look = {
		active: { chip: 'bg-success-soft text-success-text', dot: 'bg-success-text', label: 'Active' },
		pending: {
			chip: 'bg-warning-soft text-warning-text',
			dot: 'bg-warning-text',
			label: 'Pending'
		},
		archived: { chip: 'bg-surface3 text-ink-secondary', dot: 'bg-ink-secondary', label: 'Archived' }
	}[status]
	return (
		<span
			className={cn(
				'inline-flex items-center gap-[6px] self-start rounded-pill px-[10px] py-[4px]',
				look.chip
			)}
			style={{ ...type('caption'), fontWeight: 600 }}
		>
			<span className={cn('h-[6px] w-[6px] rounded-full', look.dot)} />
			{look.label}
		</span>
	)
}

/** A round icon button (IconButton): 40pt, on the raised surface. */
export function IconDisc({ children }: { children: React.ReactNode }) {
	return (
		<span className="grid h-[40px] w-[40px] place-items-center rounded-full border border-line-hairline bg-surface2 text-ink-secondary">
			{children}
		</span>
	)
}

/** One option in a single-choice list (SelectionRow): 72pt, a ring that fills when chosen. */
export function SelectionRow({
	title,
	subtitle,
	leading,
	trailing,
	isSelected = false
}: {
	title: string
	subtitle?: string
	leading?: React.ReactNode
	trailing?: React.ReactNode
	isSelected?: boolean
}) {
	return (
		<div
			className={cn(
				'flex min-h-[72px] items-center gap-[14px] rounded-row border-[1.5px] px-[16px] py-[12px]',
				isSelected ? 'border-brand-ink bg-brand-dim' : 'border-line-soft bg-surface'
			)}
		>
			{leading}
			<span className="flex flex-1 flex-col gap-[2px]">
				<span style={type('label')}>{title}</span>
				{subtitle && (
					<span className="text-ink-secondary" style={type('caption')}>
						{subtitle}
					</span>
				)}
			</span>
			{trailing ?? (
				<span
					className={cn(
						'grid h-[24px] w-[24px] place-items-center rounded-full border-[1.5px]',
						isSelected ? 'border-brand-ink bg-brand-ink text-ink-inverse' : 'border-line-active'
					)}
				>
					{isSelected && (
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M5 12.5 10 17.5 19 7"
								stroke="currentColor"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					)}
				</span>
			)}
		</div>
	)
}

const TABS = [
	{ icon: House, label: 'Home' },
	{ icon: Compass, label: 'Explore' },
	{ icon: Bell, label: 'Activity' },
	{ icon: CircleUser, label: 'Profile' }
] as const
const TAB_BAR_HEIGHT = 64
const LENS_INSET = 6

/**
 * The floating glass tab bar: a pill 4pt above the home indicator, icon and
 * label per tab, and the active tab held in a tinted lens.
 */
export function TabBar({ active = 0 }: { active?: number }) {
	return (
		<div
			className="absolute z-10 flex items-center rounded-pill border border-line-soft bg-glass-tint shadow-raised backdrop-blur-xl dusk:border-line-glass"
			style={{
				left: GUTTER,
				right: GUTTER,
				bottom: INSET_BOTTOM + 4,
				height: TAB_BAR_HEIGHT
			}}
		>
			<span
				className="absolute rounded-pill bg-brand-dim"
				style={{
					top: LENS_INSET,
					bottom: LENS_INSET,
					left: `calc(${active * 25}% + ${LENS_INSET}px)`,
					width: `calc(25% - ${LENS_INSET * 2}px)`
				}}
			/>
			{TABS.map(({ icon: Icon, label }, i) => (
				<span
					key={label}
					className={cn(
						'relative flex h-full flex-1 flex-col items-center justify-center gap-[3px]',
						i === active ? 'text-brand-ink' : 'text-ink-tertiary'
					)}
				>
					<Icon size={22} strokeWidth={1.8} />
					<span style={{ fontSize: 11, lineHeight: '14px', fontWeight: i === active ? 600 : 400 }}>
						{label}
					</span>
				</span>
			))}
		</div>
	)
}
