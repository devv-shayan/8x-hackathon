/**
 * dusk — dark, editorial, cinematic.
 *
 * A deep cool-midnight ground built as a lightness ladder (never black, never
 * grey: every step is tinted toward hue 264), a serif display face for
 * headlines, one luminous accent used sparingly, and calm motion. Opens dark;
 * also ships a light "dawn" scheme on a pale cool paper.
 *
 * Neutrals are authored here (OKLCH source in each comment) and pinned by the
 * contrast test. Accent roles are never written here — packages/brand derives
 * them from the single accent in brand.config.ts.
 */

import type { Preset } from '../src/types'

export const dusk: Preset = {
	name: 'dusk',
	primaryScheme: 'dark',
	// Luminous sky — oklch(0.80 0.118 228). Dark ink sits on it.
	defaultAccent: '#5fccf9',

	schemes: {
		dark: {
			scheme: 'dark',
			name: 'dusk',
			ground: {
				bg: '#090f1e', //       oklch(0.172 0.032 264)
				well: '#0d1525', //     oklch(0.196 0.035 264)
				surface: '#121b2d', //  oklch(0.222 0.038 264)
				surface2: '#192336', // oklch(0.256 0.040 264)
				surface3: '#222d42' //  oklch(0.296 0.042 264)
			},
			text: {
				primary: '#eff2f9', //   oklch(0.962 0.009 264)
				body: '#d2d8e2', //      oklch(0.880 0.016 264)
				secondary: '#b4bbc9', // oklch(0.790 0.021 264)
				tertiary: '#8e96a5', //  oklch(0.672 0.024 264)
				disabled: '#575e6c' //   oklch(0.480 0.024 264)
			},
			semantic: {
				success: { solid: '#007943', text: '#6cd799' },
				warning: { solid: '#f2b541', text: '#f4c767' },
				error: { solid: '#c3292e', text: '#f6908d' },
				info: { solid: '#116bb5', text: '#86c1f4' }
			},
			onFill: { ink: '#131b2e', paper: '#eff2f9' },
			shadowTint: '#02040d', // oklch(0.110 0.025 264)
			hero: { bg: '#131d36', text: '#eff2f9', textSecondary: '#b7becc' },
			alpha: {
				hairline: 0.07,
				soft: 0.11,
				active: 0.2,
				glass: 0.12,
				brandDim: 0.16,
				brandBorder: 0.42,
				brandGlow: 0.3,
				overlay: 0.64,
				scrim: 0.72,
				track: 0.14,
				semanticSoft: 0.16,
				semanticBorder: 0.4,
				glassTint: 0.55,
				shimmerSweep: 0.07
			}
		},
		light: {
			scheme: 'light',
			name: 'dawn',
			ground: {
				bg: '#f0f4fb', //       oklch(0.966 0.010 262)
				well: '#e6ebf4', //     oklch(0.938 0.013 262)
				surface: '#fbfdff', //  oklch(0.993 0.004 262)
				surface2: '#ebeff7', // oklch(0.952 0.012 262)
				surface3: '#dfe5ef' //  oklch(0.920 0.015 262)
			},
			text: {
				primary: '#131b2e', //   oklch(0.225 0.040 266)
				body: '#262f42', //      oklch(0.305 0.038 266)
				secondary: '#41495b', // oklch(0.405 0.032 266)
				tertiary: '#596070', //  oklch(0.490 0.026 266)
				disabled: '#9498a3' //   oklch(0.680 0.016 266)
			},
			semantic: {
				success: { solid: '#187c49', text: '#0f663a' },
				warning: { solid: '#f2b036', text: '#88520c' },
				error: { solid: '#c72827', text: '#a72120' },
				info: { solid: '#156ab9', text: '#0e599d' }
			},
			onFill: { ink: '#131b2e', paper: '#eff2f9' },
			shadowTint: '#253554', // oklch(0.330 0.060 264) — cool slate, never black
			hero: { bg: '#131d36', text: '#eff2f9', textSecondary: '#b7becc' },
			alpha: {
				hairline: 0.08,
				soft: 0.12,
				active: 0.22,
				glass: 0.65,
				brandDim: 0.14,
				brandBorder: 0.38,
				brandGlow: 0.26,
				overlay: 0.36,
				scrim: 0.7,
				track: 0.08,
				semanticSoft: 0.12,
				semanticBorder: 0.34,
				glassTint: 0.72,
				shimmerSweep: 0.6
			}
		}
	},

	fonts: {
		display: {
			name: 'Source Serif 4',
			fallback: "Georgia, 'Times New Roman', serif",
			files: { 400: 'SourceSerif4_400Regular', 600: 'SourceSerif4_600SemiBold' }
		},
		text: {
			name: 'Inter',
			fallback: 'system-ui, -apple-system, sans-serif',
			files: {
				400: 'Inter_400Regular',
				500: 'Inter_500Medium',
				600: 'Inter_600SemiBold',
				700: 'Inter_700Bold',
				800: 'Inter_800ExtraBold'
			}
		}
	},

	// Serif display at 600 with quiet negative tracking; Inter for everything
	// the reader operates. Caps eyebrows track wide.
	type: {
		displayHero: {
			family: 'display',
			weight: 600,
			size: 52,
			lineHeight: 56,
			tracking: -0.028,
			maxScale: 1.2
		},
		display: {
			family: 'display',
			weight: 600,
			size: 40,
			lineHeight: 44,
			tracking: -0.024,
			maxScale: 1.25
		},
		h1: {
			family: 'display',
			weight: 600,
			size: 32,
			lineHeight: 38,
			tracking: -0.02,
			maxScale: 1.3
		},
		h2: {
			family: 'display',
			weight: 600,
			size: 26,
			lineHeight: 32,
			tracking: -0.015,
			maxScale: 1.35
		},
		h3: {
			family: 'display',
			weight: 600,
			size: 20,
			lineHeight: 26,
			tracking: -0.008,
			maxScale: 1.5
		},
		title: {
			family: 'display',
			weight: 600,
			size: 26,
			lineHeight: 32,
			tracking: -0.018,
			maxScale: 1.35
		},
		question: {
			family: 'display',
			weight: 400,
			size: 28,
			lineHeight: 36,
			tracking: -0.01,
			maxScale: 1.35
		},
		lead: {
			family: 'text',
			weight: 400,
			size: 18,
			lineHeight: 27,
			tracking: -0.012,
			maxScale: 1.8
		},
		body: { family: 'text', weight: 400, size: 16, lineHeight: 24, tracking: -0.006, maxScale: 2 },
		bodySm: {
			family: 'text',
			weight: 400,
			size: 14,
			lineHeight: 20,
			tracking: -0.003,
			maxScale: 2
		},
		caption: { family: 'text', weight: 400, size: 13, lineHeight: 18, tracking: 0, maxScale: 2 },
		eyebrow: {
			family: 'text',
			weight: 600,
			size: 11,
			lineHeight: 16,
			tracking: 0.14,
			uppercase: true,
			maxScale: 1.6
		},
		label: {
			family: 'text',
			weight: 600,
			size: 15,
			lineHeight: 20,
			tracking: -0.006,
			maxScale: 1.6
		},
		labelTracked: {
			family: 'text',
			weight: 600,
			size: 13,
			lineHeight: 18,
			tracking: 0.16,
			uppercase: true,
			maxScale: 1.5
		},
		number: {
			family: 'text',
			weight: 600,
			size: 32,
			lineHeight: 36,
			tracking: -0.02,
			tabular: true,
			maxScale: 1.3
		}
	},

	radii: {
		sm: 6,
		md: 10,
		lg: 12,
		xl: 16,
		'2xl': 20,
		'3xl': 28,
		'4xl': 36,
		pill: 999,
		button: 999,
		input: 16,
		chip: 999,
		row: 20,
		card: 20,
		sheet: 28
	},

	art: { scrim: 'rgba(3,5,15,0.84)', ink: '#eff2f9' },

	// Depth is mostly lightness; shadows are long, soft and midnight-tinted.
	elevation: {
		flat: { y: 0, blur: 0, spread: 0, light: 0, dark: 0, android: 0 },
		soft: { y: 2, blur: 8, spread: 0, light: 0.06, dark: 0.3, android: 1 },
		card: { y: 6, blur: 18, spread: -4, light: 0.08, dark: 0.42, android: 3 },
		raised: { y: 12, blur: 28, spread: -8, light: 0.12, dark: 0.5, android: 6 },
		overlay: { y: 18, blur: 44, spread: -12, light: 0.18, dark: 0.6, android: 12 },
		cta: { y: 8, blur: 18, spread: -6, light: 0.2, dark: 0.45, android: 4 }
	},

	// Calm: smooth and gentle sit at or above critical damping (ratios 1.0 and
	// 1.22, no overshoot); snappy and settle, at about 0.75, overshoot by about
	// 3%, a settle rather than a bounce. Long exponential ease-out, blur
	// dissolves on the web.
	motion: {
		springs: {
			snappy: { damping: 24, stiffness: 280, mass: 0.9 },
			smooth: { damping: 26, stiffness: 170, mass: 1 },
			gentle: { damping: 28, stiffness: 120, mass: 1.1 },
			settle: { damping: 21, stiffness: 220, mass: 0.9 }
		},
		easing: {
			out: [0.16, 1, 0.3, 1],
			inOut: [0.65, 0, 0.35, 1],
			in: [0.55, 0, 0.9, 0.4]
		},
		duration: {
			fast: 200,
			base: 380,
			slow: 620,
			enter: 420,
			exit: 180,
			modalIn: 260,
			modalOut: 170
		},
		stagger: { step: 80, cap: 6, distance: 16 },
		press: { button: 0.96, card: 0.98 }
	}
}
