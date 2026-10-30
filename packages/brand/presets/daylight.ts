/**
 * daylight — light, warm, confident.
 *
 * A warm stone-paper ground (not stark white, and not cream-plus-terracotta:
 * the accent is a marigold FILL carrying dark ink, never a coral text colour),
 * graphite ink, a bold grotesque display at 800 with tight tracking, warm
 * brand-tinted shadows and crisp motion. Opens light; also ships a dark
 * "espresso" scheme built as its own warm ladder, not an inversion.
 *
 * Neutrals are authored here (OKLCH source in each comment) and pinned by the
 * contrast test. Accent roles are never written here — packages/brand derives
 * them from the single accent in brand.config.ts.
 */

import type { Preset } from '../src/types'

export const daylight: Preset = {
	name: 'daylight',
	primaryScheme: 'light',
	// Marigold — oklch(0.80 0.158 72). A fill with graphite ink on it.
	defaultAccent: '#fbab2f',

	schemes: {
		light: {
			scheme: 'light',
			name: 'daylight',
			ground: {
				bg: '#f3f0e9', //       oklch(0.955 0.0095 84) stone paper
				well: '#ede8e0', //     oklch(0.932 0.012 82)
				surface: '#fefdfb', //  oklch(0.994 0.003 84)
				surface2: '#f6f3ee', // oklch(0.965 0.008 84)
				surface3: '#e8e3da' //  oklch(0.918 0.013 82)
			},
			text: {
				primary: '#1c1915', //   oklch(0.215 0.010 70) graphite
				body: '#312d28', //      oklch(0.300 0.011 70)
				secondary: '#4c4741', // oklch(0.400 0.012 70)
				tertiary: '#645e58', //  oklch(0.485 0.012 70)
				disabled: '#9c9792' //   oklch(0.680 0.010 72)
			},
			semantic: {
				success: { solid: '#23773d', text: '#236436' },
				// Burnt orange, kept clear of the marigold accent.
				warning: { solid: '#ed8725', text: '#9a4602' },
				error: { solid: '#c52c2a', text: '#a92321' },
				info: { solid: '#036eae', text: '#025c93' }
			},
			onFill: { ink: '#1c1915', paper: '#efece6' },
			shadowTint: '#513622', // oklch(0.360 0.050 58) — warm umber, never black
			hero: { bg: '#2a1d16', text: '#efece6', textSecondary: '#c4bcb3' },
			alpha: {
				hairline: 0.09,
				soft: 0.13,
				active: 0.24,
				glass: 0.65,
				brandDim: 0.18,
				brandBorder: 0.4,
				brandGlow: 0.3,
				overlay: 0.34,
				scrim: 0.7,
				track: 0.08,
				semanticSoft: 0.12,
				semanticBorder: 0.34,
				glassTint: 0.72,
				shimmerSweep: 0.6
			}
		},
		dark: {
			scheme: 'dark',
			name: 'espresso',
			ground: {
				bg: '#1e1511', //       oklch(0.205 0.018 42)
				well: '#241915', //     oklch(0.226 0.019 43)
				surface: '#2a1f1a', //  oklch(0.250 0.020 45)
				surface2: '#332721', // oklch(0.285 0.021 47)
				surface3: '#3e312a' //  oklch(0.325 0.022 50)
			},
			text: {
				primary: '#efece6', //   oklch(0.945 0.009 85) — never pure white
				body: '#d9d3cb', //      oklch(0.870 0.013 80)
				secondary: '#bfb8ae', // oklch(0.785 0.016 75)
				tertiary: '#a79e94', //  oklch(0.705 0.018 70)
				disabled: '#685e58' //   oklch(0.490 0.016 60)
			},
			semantic: {
				success: { solid: '#23773d', text: '#79d28d' },
				warning: { solid: '#f59740', text: '#f7b56a' },
				error: { solid: '#c12e2b', text: '#f49287' },
				info: { solid: '#036eae', text: '#89c1f1' }
			},
			onFill: { ink: '#1c1915', paper: '#efece6' },
			shadowTint: '#060302', // oklch(0.100 0.012 45)
			hero: { bg: '#2a1d16', text: '#efece6', textSecondary: '#c4bcb3' },
			alpha: {
				hairline: 0.08,
				soft: 0.12,
				active: 0.22,
				glass: 0.12,
				brandDim: 0.16,
				brandBorder: 0.42,
				brandGlow: 0.26,
				overlay: 0.62,
				scrim: 0.72,
				track: 0.14,
				semanticSoft: 0.16,
				semanticBorder: 0.4,
				glassTint: 0.55,
				shimmerSweep: 0.08
			}
		}
	},

	fonts: {
		display: {
			name: 'Bricolage Grotesque',
			fallback: 'system-ui, -apple-system, sans-serif',
			files: { 700: 'BricolageGrotesque_700Bold', 800: 'BricolageGrotesque_800ExtraBold' }
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

	// Grotesque at 800 for headlines, 700 for titles, tracked tight; labels a
	// weight heavier than dusk's so the warm world reads confident.
	type: {
		displayHero: {
			family: 'display',
			weight: 800,
			size: 52,
			lineHeight: 54,
			tracking: -0.035,
			maxScale: 1.2
		},
		display: {
			family: 'display',
			weight: 800,
			size: 40,
			lineHeight: 42,
			tracking: -0.032,
			maxScale: 1.25
		},
		h1: {
			family: 'display',
			weight: 800,
			size: 30,
			lineHeight: 34,
			tracking: -0.028,
			maxScale: 1.3
		},
		h2: {
			family: 'display',
			weight: 700,
			size: 24,
			lineHeight: 29,
			tracking: -0.02,
			maxScale: 1.35
		},
		h3: {
			family: 'display',
			weight: 700,
			size: 19,
			lineHeight: 24,
			tracking: -0.012,
			maxScale: 1.5
		},
		title: {
			family: 'display',
			weight: 800,
			size: 26,
			lineHeight: 30,
			tracking: -0.026,
			maxScale: 1.35
		},
		question: {
			family: 'display',
			weight: 700,
			size: 26,
			lineHeight: 32,
			tracking: -0.02,
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
		caption: { family: 'text', weight: 500, size: 13, lineHeight: 18, tracking: 0, maxScale: 2 },
		eyebrow: {
			family: 'text',
			weight: 700,
			size: 11,
			lineHeight: 16,
			tracking: 0.12,
			uppercase: true,
			maxScale: 1.6
		},
		label: {
			family: 'text',
			weight: 700,
			size: 15,
			lineHeight: 20,
			tracking: -0.012,
			maxScale: 1.6
		},
		labelTracked: {
			family: 'text',
			weight: 700,
			size: 13,
			lineHeight: 18,
			tracking: 0.14,
			uppercase: true,
			maxScale: 1.5
		},
		number: {
			family: 'text',
			weight: 800,
			size: 32,
			lineHeight: 36,
			tracking: -0.03,
			tabular: true,
			maxScale: 1.3
		}
	},

	radii: {
		sm: 8,
		md: 12,
		lg: 14,
		xl: 18,
		'2xl': 24,
		'3xl': 32,
		'4xl': 40,
		pill: 999,
		button: 16,
		input: 14,
		chip: 999,
		row: 18,
		card: 24,
		sheet: 32
	},

	art: { scrim: 'rgba(12,6,4,0.84)', ink: '#efece6' },

	// Warm umber shadows, shorter and crisper than dusk's.
	elevation: {
		flat: { y: 0, blur: 0, spread: 0, light: 0, dark: 0, android: 0 },
		soft: { y: 2, blur: 8, spread: 0, light: 0.07, dark: 0.24, android: 1 },
		card: { y: 4, blur: 16, spread: -4, light: 0.1, dark: 0.34, android: 3 },
		raised: { y: 10, blur: 26, spread: -8, light: 0.14, dark: 0.42, android: 6 },
		overlay: { y: 16, blur: 40, spread: -10, light: 0.2, dark: 0.55, android: 12 },
		cta: { y: 6, blur: 18, spread: -6, light: 0.24, dark: 0.45, android: 4 }
	},

	// Crisp: stiffer springs. Snappy and settle are damped to about 0.65 and
	// overshoot by 6 to 7%, the settle that reads as crisp, never a bounce;
	// smooth (0.81) overshoots about 1% and gentle (0.98) not at all. Shorter
	// durations, tighter stagger.
	motion: {
		springs: {
			snappy: { damping: 22, stiffness: 340, mass: 0.8 },
			smooth: { damping: 24, stiffness: 220, mass: 1 },
			gentle: { damping: 24, stiffness: 150, mass: 1 },
			settle: { damping: 20, stiffness: 260, mass: 0.9 }
		},
		easing: {
			out: [0.2, 0.9, 0.25, 1],
			inOut: [0.6, 0, 0.3, 1],
			in: [0.5, 0, 0.85, 0.45]
		},
		duration: {
			fast: 160,
			base: 300,
			slow: 460,
			enter: 380,
			exit: 160,
			modalIn: 240,
			modalOut: 160
		},
		stagger: { step: 60, cap: 6, distance: 14 },
		press: { button: 0.96, card: 0.98 }
	}
}
