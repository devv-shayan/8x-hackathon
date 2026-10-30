/**
 * Scales shared by both presets. A preset changes the world, not the layout,
 * so spacing is one 4-point scale everywhere.
 */

/** 4-point spacing scale (dp on mobile, px on web). */
export const space = {
	0: 0,
	0.5: 2,
	1: 4,
	1.5: 6,
	2: 8,
	3: 12,
	4: 16,
	5: 20,
	6: 24,
	8: 32,
	10: 40,
	12: 48,
	16: 64,
	20: 80
} as const

export type Space = typeof space

/** Layout constants — shared by both presets (a preset changes the world, not the layout). */
export const layout = {
	/** Screen side padding on tab screens, dp. */
	gutter: 20,
	/** Wider gutter for onboarding, paywall and forms, dp. */
	gutterWide: 24,
	/** Web content max width, px. */
	maxContent: 1120,
	/** Web nav height, px (the capsule nav's bar). */
	navHeight: 56
} as const

export type Layout = typeof layout

/** The roles in the type scale, in display order (largest first). */
export const TYPE_ROLES = [
	'displayHero',
	'display',
	'h1',
	'h2',
	'h3',
	'title',
	'question',
	'lead',
	'body',
	'bodySm',
	'caption',
	'eyebrow',
	'label',
	'labelTracked',
	'number'
] as const

/** Minimum comfortable touch target (pt / dp). */
export const HIT_TARGET = 44
