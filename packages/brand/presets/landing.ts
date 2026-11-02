/**
 * landing — the website's own world, now the app's too.
 *
 * White paper, black ink, hairline rules and a lime highlight
 * (apps/web/src/components/landing/landing.css): Inter Tight for headlines and
 * text, JetBrains Mono for small labels in caps. Colour comes from the pixel
 * backgrounds (@app/pixel), so the UI around them stays black and white, with
 * lime as the one accent: a fill carrying black ink, never lime text on white.
 *
 * The app opens light and has no dark mode. The dark scheme is the website's
 * black band, kept because every preset carries both schemes and the website's
 * shared components can sit on it.
 */

import type { Preset } from '../src/types'

export const landing: Preset = {
	name: 'landing',
	primaryScheme: 'light',
	// Lime, the website's highlight: rgb(247 254 98).
	defaultAccent: '#f7fe62',

	schemes: {
		light: {
			scheme: 'light',
			name: 'paper',
			ground: {
				bg: '#ffffff', //       paper
				well: '#f6f6f3', //     wash
				surface: '#ffffff',
				surface2: '#f6f6f3',
				surface3: '#ecece8'
			},
			text: {
				primary: '#0b0b0b', //   ink
				body: '#1f1f1f',
				secondary: '#555555', // muted
				tertiary: '#666666',
				disabled: '#a3a3a3'
			},
			semantic: {
				success: { solid: '#1e7a3c', text: '#17602f' },
				warning: { solid: '#d98a00', text: '#755300' },
				error: { solid: '#be2026', text: '#a81c22' },
				info: { solid: '#2f55d4', text: '#2448b8' }
			},
			onFill: { ink: '#0b0b0b', paper: '#ffffff' },
			shadowTint: '#16160e', // ink with the lime's warmth, never pure black
			hero: { bg: '#0b0b0b', text: '#f6f6f3', textSecondary: '#b5b5ad' },
			alpha: {
				hairline: 0.09,
				soft: 0.13,
				active: 0.24,
				glass: 0.65,
				brandDim: 0.35,
				brandBorder: 0.6,
				brandGlow: 0.3,
				overlay: 0.45,
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
			name: 'black band',
			ground: {
				bg: '#0b0b0b',
				well: '#111111',
				surface: '#161616',
				surface2: '#1e1e1e',
				surface3: '#2a2a2a'
			},
			text: {
				primary: '#f6f6f3',
				body: '#e0e0da',
				secondary: '#bdbdb5',
				tertiary: '#9d9d95',
				disabled: '#5c5c56'
			},
			semantic: {
				success: { solid: '#1e7a3c', text: '#79d28d' },
				warning: { solid: '#f59740', text: '#f7b56a' },
				error: { solid: '#c12e2b', text: '#f49287' },
				info: { solid: '#2f55d4', text: '#9ab4f7' }
			},
			onFill: { ink: '#0b0b0b', paper: '#f6f6f3' },
			shadowTint: '#000000',
			hero: { bg: '#0b0b0b', text: '#f6f6f3', textSecondary: '#b5b5ad' },
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
			name: 'Inter Tight',
			fallback: 'system-ui, -apple-system, sans-serif',
			files: {
				600: 'InterTight_600SemiBold',
				700: 'InterTight_700Bold',
				800: 'InterTight_800ExtraBold'
			}
		},
		text: {
			name: 'Inter Tight',
			fallback: 'system-ui, -apple-system, sans-serif',
			files: {
				400: 'InterTight_400Regular',
				500: 'InterTight_500Medium',
				600: 'InterTight_600SemiBold',
				700: 'InterTight_700Bold',
				800: 'InterTight_800ExtraBold'
			}
		},
		mono: {
			name: 'JetBrains Mono',
			fallback: 'ui-monospace, Menlo, monospace',
			files: { 500: 'JetBrainsMono_500Medium' }
		}
	},

	// One grotesque, tracked tight as it grows; labels in mono caps, tracked open.
	type: {
		displayHero: {
			family: 'display',
			weight: 800,
			size: 52,
			lineHeight: 52,
			tracking: -0.04,
			maxScale: 1.2
		},
		display: {
			family: 'display',
			weight: 800,
			size: 44,
			lineHeight: 44,
			tracking: -0.036,
			maxScale: 1.25
		},
		h1: {
			family: 'display',
			weight: 700,
			size: 30,
			lineHeight: 34,
			tracking: -0.027,
			maxScale: 1.3
		},
		h2: {
			family: 'display',
			weight: 700,
			size: 24,
			lineHeight: 28,
			tracking: -0.02,
			maxScale: 1.35
		},
		h3: {
			family: 'display',
			weight: 700,
			size: 17,
			lineHeight: 22,
			tracking: -0.01,
			maxScale: 1.5
		},
		title: {
			family: 'display',
			weight: 800,
			size: 30,
			lineHeight: 34,
			tracking: -0.027,
			maxScale: 1.35
		},
		question: {
			family: 'display',
			weight: 700,
			size: 30,
			lineHeight: 34,
			tracking: -0.027,
			maxScale: 1.35
		},
		lead: {
			family: 'text',
			weight: 500,
			size: 17,
			lineHeight: 22,
			tracking: -0.01,
			maxScale: 1.8
		},
		body: { family: 'text', weight: 400, size: 16, lineHeight: 24, tracking: -0.006, maxScale: 2 },
		bodySm: {
			family: 'text',
			weight: 500,
			size: 15,
			lineHeight: 20,
			tracking: -0.004,
			maxScale: 2
		},
		caption: { family: 'text', weight: 500, size: 13, lineHeight: 18, tracking: 0, maxScale: 2 },
		eyebrow: {
			family: 'mono',
			weight: 500,
			size: 11,
			lineHeight: 16,
			tracking: 0.08,
			uppercase: true,
			maxScale: 1.6
		},
		label: {
			family: 'text',
			weight: 700,
			size: 17,
			lineHeight: 22,
			tracking: -0.01,
			maxScale: 1.6
		},
		labelTracked: {
			family: 'mono',
			weight: 500,
			size: 12,
			lineHeight: 16,
			tracking: 0.08,
			uppercase: true,
			maxScale: 1.5
		},
		number: {
			family: 'display',
			weight: 800,
			size: 32,
			lineHeight: 34,
			tracking: -0.04,
			tabular: true,
			maxScale: 1.3
		}
	},

	// Capsule buttons and fields, square mono chips, and a sheet concentric with the
	// iPhone's display corner (55 less the 8 it is inset by).
	radii: {
		sm: 6,
		md: 10,
		lg: 14,
		xl: 18,
		'2xl': 22,
		'3xl': 26,
		'4xl': 32,
		pill: 999,
		button: 999,
		input: 16,
		chip: 2,
		row: 18,
		card: 22,
		sheet: 47
	},

	art: { scrim: 'rgba(11,11,11,0.84)', ink: '#f6f6f3' },

	// Quiet shadows: the website draws edges with hairlines, not depth.
	elevation: {
		flat: { y: 0, blur: 0, spread: 0, light: 0, dark: 0, android: 0 },
		soft: { y: 1, blur: 2, spread: 0, light: 0.08, dark: 0.24, android: 1 },
		card: { y: 6, blur: 18, spread: -4, light: 0.1, dark: 0.34, android: 3 },
		raised: { y: 10, blur: 26, spread: -8, light: 0.14, dark: 0.42, android: 6 },
		overlay: { y: 16, blur: 40, spread: -10, light: 0.2, dark: 0.55, android: 12 },
		cta: { y: 6, blur: 18, spread: -6, light: 0.18, dark: 0.45, android: 4 }
	},

	// Crisp, as daylight: settles without a bounce.
	motion: {
		springs: {
			snappy: { damping: 22, stiffness: 340, mass: 0.8 },
			smooth: { damping: 24, stiffness: 220, mass: 1 },
			gentle: { damping: 24, stiffness: 150, mass: 1 },
			settle: { damping: 20, stiffness: 260, mass: 0.9 }
		},
		easing: {
			out: [0.22, 1, 0.36, 1],
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
		stagger: { step: 50, cap: 6, distance: 10 },
		press: { button: 0.97, card: 0.98 }
	}
}
