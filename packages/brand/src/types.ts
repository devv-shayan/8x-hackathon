/**
 * The token model. Every value a screen reads is named for its ROLE (what it
 * is for), never for its value, so a preset can change the world without a
 * screen noticing.
 */

import type { Layout, Space } from './scale'

export type PresetName = 'dusk' | 'daylight'
export type Scheme = 'light' | 'dark'

// ── Colour ────────────────────────────────────────────────────────────────────

/**
 * One palette = one preset × one scheme. Four exist: dusk/dark, dusk/light
 * ("dawn"), daylight/light, daylight/dark ("espresso").
 */
export interface Palette {
	preset: PresetName
	scheme: Scheme
	/** Human name of this palette: 'dusk', 'dawn', 'daylight', 'espresso'. */
	name: string

	// Ground ladder — depth is lightness, not shadow. Dark schemes step lighter
	// as they rise; light schemes put cards above a slightly darker paper.
	/** The page. */
	bg: string
	/** `bg` at zero alpha — fade to this, never to 'transparent' (which smears through black). */
	bgFade: string
	/** Inset areas: inputs, wells, sunken groups. */
	well: string
	/** Cards and rows. */
	surface: string
	/** Raised or nested: chips, inputs on cards, popovers. */
	surface2: string
	/** Highest neutral: modals on dark, pressed rows, segmented tracks. */
	surface3: string

	// Text tiers — each one is AA (4.5:1) on every ground above (tested).
	textPrimary: string
	/** Long-form reading copy; a step softer than primary. */
	textBody: string
	textSecondary: string
	/** Captions, metadata, placeholders — the floor that still passes AA. */
	textTertiary: string
	/** Inactive controls only (WCAG exempts them); never for information. */
	textDisabled: string
	/** Text on a `textPrimary`-coloured fill (inverted chips, tooltips). */
	textInverse: string

	// Borders
	borderHairline: string
	borderSoft: string
	borderActive: string
	/** Keyboard focus ring — ≥ 3:1 on bg (tested). */
	borderFocus: string
	/** Top-lit edge on glass and raised panes. */
	borderGlass: string

	// Accent roles — all derived from the single accent hex in brand.config.
	/** The brand hex itself: buttons, selected pills, progress fills. */
	brandFill: string
	/** Hover / pressed fill: moves away from `onBrand`, so contrast only rises. */
	brandFillHover: string
	/** The accent as TEXT or ICON on the grounds — adjusted until AA. */
	brandInk: string
	/** Text and icons on `brandFill` / `brandGradient`. */
	onBrand: string
	/** Tinted background for selected rows, accent chips. */
	brandDim: string
	/** Border of accent chips and selected cards. */
	brandBorder: string
	/** Soft atmospheric glow (radial washes). Never a halo around an element. */
	brandGlow: string
	/** Two stops around `brandFill`; `onBrand` passes on both. */
	brandGradient: readonly [string, string]

	// Semantic: solid (fills, icons), on (text on solid), soft (tinted fill),
	// border, text (readable on grounds and on its own soft fill).
	success: string
	onSuccess: string
	successSoft: string
	successBorder: string
	successText: string
	warning: string
	onWarning: string
	warningSoft: string
	warningBorder: string
	warningText: string
	error: string
	onError: string
	errorSoft: string
	errorBorder: string
	errorText: string
	info: string
	onInfo: string
	infoSoft: string
	infoBorder: string
	infoText: string

	// Utility
	/** Modal / sheet backdrop. */
	overlay: string
	/** Legibility wash over content (teasers, locked previews). */
	scrim: string
	/** Scheme-invariant dark wash for text over imagery. */
	artScrim: string
	/** Text over `artScrim` — stays light in both schemes. */
	inkOnArt: string
	/** Empty track: progress bars, switch-off, sliders. */
	tintTrack: string
	/** Skeleton block. */
	shimmer: string
	/** The highlight that sweeps across a skeleton. */
	shimmerSweep: string
	/** Colour every shadow is cast in (never plain black). */
	shadowTint: string
	/** expo-blur material under glass bars. */
	blurTint: 'systemThinMaterialDark' | 'systemThinMaterialLight'
	/** Low-alpha tint laid over the blur (glass = blur + tint + glass border). */
	glassTint: string
	/** Solid fallback where blur is unavailable or expensive (Android). */
	glassFallback: string
	/** expo-status-bar style. */
	statusBarStyle: 'light' | 'dark'

	// Hero — a surface that stays dark in BOTH schemes (feature panels, recap cards).
	hero: string
	heroText: string
	heroTextSecondary: string
	heroBorder: string
	/** The accent as text on `hero`. */
	heroBrandInk: string
}

export type ColorRole = {
	[K in keyof Palette]: Palette[K] extends string ? K : never
}[keyof Palette]

/**
 * What a preset authors per scheme. Neutrals and semantic seeds are
 * hand-picked (and contrast-tested); everything accent is derived.
 */
export interface SchemeSpec {
	scheme: Scheme
	name: string
	ground: {
		bg: string
		well: string
		surface: string
		surface2: string
		surface3: string
	}
	text: {
		primary: string
		body: string
		secondary: string
		tertiary: string
		disabled: string
	}
	/** Semantic solids (fills/icons) and text colours for this scheme. */
	semantic: Record<'success' | 'warning' | 'error' | 'info', { solid: string; text: string }>
	/** Dark ink and light paper candidates for text on fills (onBrand, onSuccess…). */
	onFill: { ink: string; paper: string }
	/** Near-black in the ground's hue: shadows, overlays, art scrims. */
	shadowTint: string
	hero: { bg: string; text: string; textSecondary: string }
	/** Alpha strengths — dark and light grounds need different amounts. */
	alpha: {
		hairline: number
		soft: number
		active: number
		glass: number
		brandDim: number
		brandBorder: number
		brandGlow: number
		overlay: number
		scrim: number
		track: number
		semanticSoft: number
		semanticBorder: number
		glassTint: number
		shimmerSweep: number
	}
}

// ── Type ──────────────────────────────────────────────────────────────────────

export type TypeRole =
	| 'displayHero'
	| 'display'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'title'
	| 'question'
	| 'lead'
	| 'body'
	| 'bodySm'
	| 'caption'
	| 'eyebrow'
	| 'label'
	| 'labelTracked'
	| 'number'

/** `display` is the preset's headline face; `text` is the workhorse (Inter). */
export type FontGroup = 'display' | 'text'
export type FontWeight = 400 | 500 | 600 | 700 | 800

export interface TypeSpec {
	family: FontGroup
	weight: FontWeight
	/** px (dp on mobile). */
	size: number
	/** px (dp on mobile). */
	lineHeight: number
	/** em. Negative for anything bold or large, positive for caps. */
	tracking: number
	uppercase?: boolean
	/** Tabular figures — every number that can change. */
	tabular?: boolean
	/** Cap on OS font scaling so display type does not break layout. */
	maxScale: number
}

export interface FontFamilySpec {
	/** Family name as Google Fonts spells it (web). */
	name: string
	/** CSS fallback stack after the loaded face. */
	fallback: string
	/** Font keys registered with expo-font, by weight (mobile). */
	files: Partial<Record<FontWeight, string>>
}

// ── Shape, space, depth, motion ───────────────────────────────────────────────

export interface Radii {
	sm: number
	md: number
	lg: number
	xl: number
	'2xl': number
	'3xl': number
	'4xl': number
	pill: number
	/** Role aliases, so screens ask for a purpose rather than a size. */
	button: number
	input: number
	chip: number
	row: number
	card: number
	sheet: number
}

export type ElevationLevel = 'flat' | 'soft' | 'card' | 'raised' | 'overlay' | 'cta'

export interface ElevationSpec {
	y: number
	blur: number
	/** CSS spread (web only). */
	spread: number
	/** Opacity of shadowTint on light grounds / dark grounds. */
	light: number
	dark: number
	/** Android elevation. */
	android: number
}

/** React Native shadow props for one level on one palette. */
export interface NativeShadow {
	shadowColor: string
	shadowOffset: { width: number; height: number }
	shadowOpacity: number
	shadowRadius: number
	elevation: number
}

export interface SpringSpec {
	damping: number
	stiffness: number
	mass: number
}

export type Bezier = readonly [number, number, number, number]

export interface MotionSpec {
	springs: {
		/** Taps, toggles, tab switches. */
		snappy: SpringSpec
		/** Sheets, panels, the tab lens. */
		smooth: SpringSpec
		/** Large, calm moves: hero reveals, onboarding pages. */
		gentle: SpringSpec
		/** Snap-backs after a drag, card keep/settle. */
		settle: SpringSpec
	}
	easing: {
		/** Entrances and most transitions. */
		out: Bezier
		inOut: Bezier
		/** Exits. */
		in: Bezier
	}
	duration: {
		fast: number
		base: number
		slow: number
		enter: number
		exit: number
		modalIn: number
		modalOut: number
	}
	stagger: {
		/** Delay between staggered siblings, ms. */
		step: number
		/** Index cap so long lists do not crawl. */
		cap: number
		/** Rise distance for entrances, px/dp. */
		distance: number
	}
	press: {
		/** Buttons and small tappables. */
		button: number
		/** Cards and large tappables. */
		card: number
	}
}

// ── Preset & theme ────────────────────────────────────────────────────────────

export interface Preset {
	name: PresetName
	/** The scheme a fresh install opens in. */
	primaryScheme: Scheme
	/** Used when brand.config sets `accent: 'default'`. */
	defaultAccent: string
	schemes: Record<Scheme, SchemeSpec>
	fonts: Record<FontGroup, FontFamilySpec>
	type: Record<TypeRole, TypeSpec>
	radii: Radii
	/** Scheme-invariant wash + ink for text over imagery. */
	art: { scrim: string; ink: string }
	elevation: Record<ElevationLevel, ElevationSpec>
	motion: MotionSpec
}

export interface Theme {
	preset: PresetName
	primaryScheme: Scheme
	accent: string
	palettes: Record<Scheme, Palette>
	fonts: Record<FontGroup, FontFamilySpec>
	type: Record<TypeRole, TypeSpec>
	radii: Radii
	space: Space
	layout: Layout
	elevation: Record<Scheme, Record<ElevationLevel, NativeShadow>>
	/** CSS box-shadow strings, per scheme. */
	shadowCss: Record<Scheme, Record<ElevationLevel, string>>
	motion: MotionSpec
}
