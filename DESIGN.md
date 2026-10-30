---
name: Play Template
description: One brand package, two worlds (dusk and daylight), shared by the Expo app and its marketing site.
colors:
  # Values are the four palettes packages/brand builds with `accent: 'default'`.
  # Neutrals are authored in packages/brand/presets/*; every brand-* value is
  # DERIVED from the one accent hex in brand.config.ts and changes with it.
  # dusk / dark (dusk's primary scheme)
  dusk-bg: '#090f1e'
  dusk-well: '#0d1525'
  dusk-surface: '#121b2d'
  dusk-surface2: '#192336'
  dusk-surface3: '#222d42'
  dusk-text-primary: '#eff2f9'
  dusk-text-body: '#d2d8e2'
  dusk-text-secondary: '#b4bbc9'
  dusk-text-tertiary: '#8e96a5'
  dusk-brand-fill: '#5fccf9'
  dusk-brand-fill-hover: '#82d9ff'
  dusk-brand-ink: '#5fccf9'
  dusk-on-brand: '#131b2e'
  dusk-brand-dim: 'rgba(95,204,249,0.16)'
  dusk-brand-glow: 'rgba(95,204,249,0.3)'
  dusk-hero: '#131d36'
  dusk-shadow-tint: '#02040d'
  dusk-success-text: '#6cd799'
  dusk-warning-text: '#f4c767'
  dusk-error-text: '#f6908d'
  # dusk / light ("dawn")
  dawn-bg: '#f0f4fb'
  dawn-surface: '#fbfdff'
  dawn-text-primary: '#131b2e'
  dawn-text-secondary: '#41495b'
  dawn-brand-ink: '#006a8a'
  # daylight / light (daylight's primary scheme)
  daylight-bg: '#f3f0e9'
  daylight-well: '#ede8e0'
  daylight-surface: '#fefdfb'
  daylight-surface2: '#f6f3ee'
  daylight-surface3: '#e8e3da'
  daylight-text-primary: '#1c1915'
  daylight-text-body: '#312d28'
  daylight-text-secondary: '#4c4741'
  daylight-text-tertiary: '#645e58'
  daylight-brand-fill: '#fbab2f'
  daylight-brand-fill-hover: '#ffbe69'
  daylight-brand-ink: '#845500'
  daylight-on-brand: '#1c1915'
  daylight-brand-dim: 'rgba(251,171,47,0.18)'
  daylight-brand-glow: 'rgba(251,171,47,0.3)'
  daylight-hero: '#2a1d16'
  daylight-hero-text: '#efece6'
  daylight-shadow-tint: '#513622'
  daylight-success-text: '#236436'
  daylight-warning-text: '#9a4602'
  daylight-error-text: '#a92321'
  # daylight / dark ("espresso")
  espresso-bg: '#1e1511'
  espresso-surface: '#2a1f1a'
  espresso-text-primary: '#efece6'
  espresso-text-secondary: '#bfb8ae'
  espresso-brand-ink: '#fbab2f'
typography:
  # The role scale at app size (pt on mobile; the web's phone renders it 1:1).
  dusk-display-hero:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: '52px'
    fontWeight: 600
    lineHeight: '56px'
    letterSpacing: '-0.028em'
  daylight-display-hero:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: '52px'
    fontWeight: 800
    lineHeight: '54px'
    letterSpacing: '-0.035em'
  dusk-display:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: '40px'
    fontWeight: 600
    lineHeight: '44px'
    letterSpacing: '-0.024em'
  daylight-display:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: '40px'
    fontWeight: 800
    lineHeight: '42px'
    letterSpacing: '-0.032em'
  dusk-h1:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: '32px'
    fontWeight: 600
    lineHeight: '38px'
    letterSpacing: '-0.02em'
  daylight-h1:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: '30px'
    fontWeight: 800
    lineHeight: '34px'
    letterSpacing: '-0.028em'
  dusk-title:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: '26px'
    fontWeight: 600
    lineHeight: '32px'
    letterSpacing: '-0.018em'
  daylight-title:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: '26px'
    fontWeight: 800
    lineHeight: '30px'
    letterSpacing: '-0.026em'
  dusk-question:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: '28px'
    fontWeight: 400
    lineHeight: '36px'
    letterSpacing: '-0.01em'
  daylight-question:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: '26px'
    fontWeight: 700
    lineHeight: '32px'
    letterSpacing: '-0.02em'
  dusk-h3:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: '20px'
    fontWeight: 600
    lineHeight: '26px'
    letterSpacing: '-0.008em'
  daylight-h3:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: '19px'
    fontWeight: 700
    lineHeight: '24px'
    letterSpacing: '-0.012em'
  lead:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '18px'
    fontWeight: 400
    lineHeight: '27px'
    letterSpacing: '-0.012em'
  body:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: '24px'
    letterSpacing: '-0.006em'
  body-sm:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: '20px'
    letterSpacing: '-0.003em'
  dusk-label:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '15px'
    fontWeight: 600
    lineHeight: '20px'
    letterSpacing: '-0.006em'
  daylight-label:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '15px'
    fontWeight: 700
    lineHeight: '20px'
    letterSpacing: '-0.012em'
  dusk-caption:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '13px'
    fontWeight: 400
    lineHeight: '18px'
    letterSpacing: '0'
  daylight-caption:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '13px'
    fontWeight: 500
    lineHeight: '18px'
    letterSpacing: '0'
  dusk-number:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '32px'
    fontWeight: 600
    lineHeight: '36px'
    letterSpacing: '-0.02em'
    fontFeature: "'tnum' 1"
  daylight-number:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: '32px'
    fontWeight: 800
    lineHeight: '36px'
    letterSpacing: '-0.03em'
    fontFeature: "'tnum' 1"
  # The web's sizes for the same roles (apps/web/src/app/globals.css .t-*).
  dusk-web-hero:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(2.75rem, 1.55rem + 4.95vw, 6rem)'
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: '-0.028em'
  daylight-web-hero:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: 'clamp(2.75rem, 1.55rem + 4.95vw, 6rem)'
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: '-0.035em'
  dusk-web-display:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(2.1rem, 1.3rem + 3.3vw, 4.4rem)'
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: '-0.024em'
  daylight-web-display:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: 'clamp(2.1rem, 1.3rem + 3.3vw, 4.4rem)'
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: '-0.032em'
  dusk-web-h1:
    fontFamily: "Source Serif 4, Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(2rem, 1.35rem + 2.4vw, 3.35rem)'
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  daylight-web-h1:
    fontFamily: 'Bricolage Grotesque, system-ui, -apple-system, sans-serif'
    fontSize: 'clamp(2rem, 1.35rem + 2.4vw, 3.35rem)'
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: '-0.028em'
  web-lead:
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    fontSize: 'clamp(1.075rem, 1rem + 0.35vw, 1.25rem)'
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: '-0.012em'
rounded:
  pill: '999px'
  dusk-button: '999px'
  daylight-button: '16px'
  dusk-input: '16px'
  daylight-input: '14px'
  dusk-row: '20px'
  daylight-row: '18px'
  dusk-card: '20px'
  daylight-card: '24px'
  dusk-sheet: '28px'
  daylight-sheet: '32px'
  dusk-xl: '16px'
  daylight-xl: '18px'
  dusk-2xl: '20px'
  daylight-2xl: '24px'
  dusk-4xl: '36px'
  daylight-4xl: '40px'
spacing:
  '0.5': '2px'
  '1': '4px'
  '1.5': '6px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
  '16': '64px'
  '20': '80px'
  gutter: '20px'
  gutter-wide: '24px'
  hit-target: '44px'
  web-content-max: '1120px'
  web-gutter: '20px'
  web-gutter-sm: '32px'
  web-section-y: '112px'
  web-section-y-sm: '144px'
components:
  store-pill:
    backgroundColor: '{colors.dusk-text-primary}'
    textColor: '{colors.dusk-bg}'
    rounded: '{rounded.pill}'
    height: '56px'
    padding: '0 24px 0 20px'
  store-pill-daylight:
    backgroundColor: '{colors.daylight-text-primary}'
    textColor: '{colors.daylight-surface}'
    rounded: '{rounded.pill}'
    height: '56px'
    padding: '0 24px 0 20px'
  nav-capsule:
    backgroundColor: '{colors.dusk-bg}'
    textColor: '{colors.dusk-text-secondary}'
    rounded: '{rounded.pill}'
    height: '56px'
    padding: '0 8px 0 16px'
  nav-cta:
    backgroundColor: '{colors.dusk-text-primary}'
    textColor: '{colors.dusk-bg}'
    rounded: '{rounded.pill}'
    height: '40px'
    padding: '0 16px'
  app-button-primary:
    backgroundColor: '{colors.dusk-brand-fill}'
    textColor: '{colors.dusk-on-brand}'
    typography: '{typography.dusk-label}'
    rounded: '{rounded.dusk-button}'
    height: '56px'
    padding: '0 26px'
  app-button-primary-daylight:
    backgroundColor: '{colors.daylight-brand-fill}'
    textColor: '{colors.daylight-on-brand}'
    typography: '{typography.daylight-label}'
    rounded: '{rounded.daylight-button}'
    height: '56px'
    padding: '0 26px'
  app-button-secondary:
    backgroundColor: '{colors.dusk-brand-dim}'
    textColor: '{colors.dusk-brand-ink}'
    rounded: '{rounded.dusk-button}'
    height: '50px'
    padding: '0 22px'
  pane:
    backgroundColor: '{colors.dusk-surface}'
    textColor: '{colors.dusk-text-primary}'
    rounded: '{rounded.dusk-card}'
    padding: '36px'
  pane-daylight:
    backgroundColor: '{colors.daylight-surface}'
    textColor: '{colors.daylight-text-primary}'
    rounded: '{rounded.daylight-card}'
    padding: '36px'
  plan-card-featured-daylight:
    backgroundColor: '{colors.daylight-brand-fill}'
    textColor: '{colors.daylight-on-brand}'
    rounded: '{rounded.daylight-card}'
    padding: '32px'
  hero-band:
    backgroundColor: '{colors.dusk-hero}'
    textColor: '{colors.dusk-text-primary}'
    rounded: '{rounded.dusk-card}'
    padding: '56px'
  text-field:
    backgroundColor: '{colors.dusk-well}'
    textColor: '{colors.dusk-text-primary}'
    rounded: '{rounded.dusk-input}'
    height: '52px'
    padding: '0 16px'
  selection-row:
    backgroundColor: '{colors.dusk-surface}'
    textColor: '{colors.dusk-text-primary}'
    rounded: '{rounded.dusk-row}'
    height: '72px'
    padding: '12px 16px'
  status-badge:
    textColor: '{colors.dusk-success-text}'
    typography: '{typography.dusk-caption}'
    rounded: '{rounded.pill}'
    padding: '4px 10px'
  tab-bar:
    backgroundColor: '{colors.dusk-well}'
    textColor: '{colors.dusk-text-tertiary}'
    rounded: '{rounded.pill}'
    height: '64px'
---

# Design System: Play Template

This file records the system as built. It covers the shared brand package first, then the two
surfaces that read from it: the marketing site (`apps/web`) and the app (`apps/mobile`). Each
section keeps that order, shared then web then app, so either app's agent can extend its own
part without touching the other's. Tokens in the frontmatter are normative. `packages/brand` is
the source they come from: when the two disagree, the package is right and this file is stale.

## Overview

**Creative North Star: "One Stage, Two Lights"**

The template is one structure lit two ways. The structure is shared: the same screens,
components, layout, spacing, radius roles and motion grammar on both surfaces and in both
presets. The preset in `packages/brand/brand.config.ts` changes only the lighting. **Dusk** is
a cool midnight room built as a lightness ladder, headed in Source Serif 4 at 600, where the
accent (a luminous sky blue) lights the room as a wide wash falling across the scene under film
grain, and is otherwise ink for links and counters, with things dissolving into place out of a
blur. **Daylight** is warm stone paper
under graphite ink, headed in Bricolage Grotesque at 800 and tracked tight, where the accent (a
marigold) is a solid field that the product stands on, with things rising crisply into place.
In both, the accent is the only light in the room, and it has two jobs: glow (dusk) or field
(daylight) for atmosphere, once per view as its bright moment; and accent ink for interactive
text (links, counters, progress, checks) and the one primary fill (the brand mark, the featured
plan's button).

The product is the picture. The site does not describe the app with icons and screenshot slots;
it renders the app's own screens in HTML from the same tokens, on a real-proportion phone, and
lets them do the showing. The app, in turn, is a calm, dense, one-hand interface: tab screens on
a 20pt gutter, cards on a ground ladder, a floating glass tab bar, and one physical feel for every
touch (a spring and a meaning-named haptic).

A play rebrands the whole system with three edits in one file: the preset, one accent hex, and
the names. Everything accent-coloured is derived from that hex with WCAG AA contrast proven by
test. Anything a play must change is marked `🎨 BRAND` (a brand decision) or `🎨 REPLACE`
(sample content, copy or imagery), so it can be found by searching.

**Key Characteristics:**

- Two presets over one structure; a preset changes the world, never the layout.
- Colour by role only (`bg`, `surface2`, `brandInk`, `onBrand`), never by value; no hex outside
  `packages/brand`.
- One accent hex; every accent role derived from it and AA tested across four palettes.
- Depth from a lightness ladder first, tinted shadow second, never black shadow.
- The accent is glow for atmosphere (dusk) or a field (daylight marigold), once per view, never
  a halo; elsewhere it is accent ink for interactive text and the one primary fill.
- The website's phone is the app, rendered from the app's primitives at 393 × 852 pt.
- Motion from the preset: dusk calm and blurred, daylight crisp; no bounce; reduced motion
  honoured on both surfaces.

### The two worlds

|                       | dusk                                                            | daylight                                                                 |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Opens in              | dark (`dusk`); also ships light (`dawn`)                        | light (`daylight`); also ships dark (`espresso`)                         |
| Ground                | cool midnight ladder, every step tinted to hue 264              | warm stone paper; espresso is its own warm dark ladder, not an inversion |
| Display face          | Source Serif 4, 600 (400 for questions)                         | Bricolage Grotesque, 800 (700 for h2, h3, questions)                     |
| Accent default        | luminous sky `#5fccf9`                                          | marigold `#fbab2f`, a fill carrying graphite ink                         |
| How the accent lights | a wide radial wash under film grain                             | a solid field running off the page edge                                  |
| Shadow tint           | midnight, long and soft                                         | warm umber, shorter and crisper                                          |
| Button corner         | pill                                                            | 16px rounded rectangle                                                   |
| Motion                | calm: slower springs, long exponential ease-out, blur dissolves | crisp: stiffer springs, shorter durations, tighter stagger, clean rises  |

### Motion (shared tokens)

Every value comes from the preset (`theme.motion`); the web reads it as CSS variables
(`--ease-out`, `--dur-*`, `--stagger-step`, `--rise`) and as Motion springs through
`<MotionProvider>`; the app reads it through `lib/motion.ts` as Reanimated configs.

- **Springs** (damping / stiffness / mass). Dusk: snappy 24/280/0.9, smooth 26/170/1, gentle
  28/120/1.1, settle 21/220/0.9. Daylight: snappy 22/340/0.8, smooth 24/220/1, gentle 24/150/1,
  settle 20/260/0.9. Damping ratios run from 0.65 (daylight settle) to 1.22 (dusk gentle): the
  stiffest springs (daylight snappy and settle, about 0.65) overshoot by at most about 7%, a
  settle rather than a bounce, and smooth and gentle sit at or near critical. Roles: snappy for taps and toggles, smooth for sheets,
  panels, the tab lens and the story camera, gentle for large calm moves (hero tilt, dealt
  cards), settle for snap-backs after a drag or a press.
- **Easing** (cubic-bezier). Dusk: out `0.16,1,0.3,1`, inOut `0.65,0,0.35,1`, in
  `0.55,0,0.9,0.4`. Daylight: out `0.2,0.9,0.25,1`, inOut `0.6,0,0.3,1`, in `0.5,0,0.85,0.45`.
  Out is the default for entrances and most transitions; in is for exits. Never linear.
- **Durations, ms** (fast / base / slow / enter / exit / modalIn / modalOut). Dusk: 200 / 380 /
  620 / 420 / 180 / 260 / 170. Daylight: 160 / 300 / 460 / 380 / 160 / 240 / 160.
- **Stagger.** Dusk steps 80ms, daylight 60ms; both cap at the 6th sibling so long lists do not
  crawl. Entrance rise distance: dusk 16, daylight 14 (pt or px).
- **Press.** Buttons spring to 0.96, cards to 0.98, on both presets.

**The No Bounce Rule.** Springs settle, they never bounce: no spring below a damping ratio of
0.65, and large travelling moves (the story camera, the hero tilt and drift, the tab lens, dealt
cards) use smooth or gentle, which sit at or near critical. Sheets open and close on timings, not
springs. A spring added for a new component picks one of the four named springs; it never tunes
its own.

**The Stillness Rule.** Reduced motion is honoured on both surfaces. Nothing travels, scales,
blurs or wipes; what carries meaning stays as an instant change or a short crossfade (on the web,
the story still crossfades between acts and its light still changes, because both say which act
you are on). The app's every spring and timing carries `ReduceMotion.System`; loops check
`useReducedMotion()` and hold still.

## Colors

Each preset authors its neutrals and semantic seeds by hand, pinned in OKLCH and proven by the
contrast test. The accent is never authored per palette: `packages/brand/src/palette.ts` derives
every accent role from one hex.

### Primary

- **Luminous Sky** (dusk default accent, `{colors.dusk-brand-fill}`, oklch 0.80 0.118 228): the
  accent as a fill (primary buttons, selected pills, progress fills, the logo mark) and as light
  (`brandGlow`, the fill at 30% on dusk, 26% on dawn). On dawn's pale paper the same hue is
  darkened to **Deep Sky Ink** (`{colors.dawn-brand-ink}`) for any accent text or icon.
- **Marigold** (daylight default accent, `{colors.daylight-brand-fill}`, oklch 0.80 0.158 72):
  a fill carrying graphite ink, never a text colour on paper. As text or icon on paper it becomes
  **Burnt Marigold Ink** (`{colors.daylight-brand-ink}`). On espresso it reads at full strength.

The derived accent roles, in every palette:

- `brandFill`: the hex itself. `brandFillHover`: moved in OKLCH lightness away from its text
  colour, so contrast only rises on hover.
- `onBrand`: text on the fill, whichever of the preset's ink or paper contrasts more (both
  defaults pick dark ink: 9.4:1 on sky, 9.2:1 on marigold).
- `brandInk`: the accent as text or icon on the grounds, lightness moved with hue held until it
  clears AA on every ground and on its own dim chip. Also the focus ring (`borderFocus`).
- `brandDim` (the fill at 14 to 18%): selected rows, accent chips, the tab lens.
  `brandBorder`: the ink at about 40%. `brandGradient`: two stops around the fill, compressed
  until `onBrand` passes on both; primary buttons and the logo mark paint it.
- `heroBrandInk`: the accent as text on the hero surface.

### Neutral

Four palettes, each a ground ladder (`bg`, `well`, `surface`, `surface2`, `surface3`) and five
text tiers (`textPrimary`, `textBody`, `textSecondary`, `textTertiary`, `textDisabled`).

- **Midnight Ladder** (dusk): `{colors.dusk-bg}` for the page, `{colors.dusk-well}` for insets
  and inputs, then `{colors.dusk-surface}`, `{colors.dusk-surface2}`, `{colors.dusk-surface3}`
  stepping lighter as things rise. Never black, never grey: every step leans to hue 264.
- **Moonlit Ink** (dusk text): `{colors.dusk-text-primary}` for headings and controls,
  `{colors.dusk-text-body}` for long reading, `{colors.dusk-text-secondary}` for supporting
  copy, `{colors.dusk-text-tertiary}` (6.4:1 on bg) as the floor for captions and placeholders.
- **Dawn Paper** (dusk light): pale cool paper `{colors.dawn-bg}` with white cards
  `{colors.dawn-surface}` above it and navy ink `{colors.dawn-text-primary}`.
- **Stone Paper** (daylight): `{colors.daylight-bg}`; cards sit above it on near-white
  `{colors.daylight-surface}`; insets drop to `{colors.daylight-well}`. Not stark white, and not
  cream.
- **Graphite** (daylight text): `{colors.daylight-text-primary}` down to
  `{colors.daylight-text-tertiary}` (5.6:1 on bg), all warm and slightly brown.
- **Espresso** (daylight dark): its own warm ladder from `{colors.espresso-bg}`, with text
  `{colors.espresso-text-primary}` that is never pure white.
- **Borders** are `textPrimary` at an alpha, not a grey: hairline 7 to 9%, soft 11 to 13%,
  active 20 to 24%. `borderGlass` is white at 12% on dark grounds (the top-lit edge).

### Semantic and hero

- **Semantic** (success, warning, error, info): a solid for fills and icons, `on*` text for
  that solid, a soft tint (16% on dark, 12% on light), a border, and a `*Text` colour readable on
  the grounds and on its own soft tint. Daylight's warning is a burnt orange kept clear of the
  marigold accent.
- **Hero surface** (`{colors.dusk-hero}` on dusk, `{colors.daylight-hero}` on daylight): a
  panel that stays dark in both schemes, with its own text tiers. The app's home stat panel and
  the profile's upgrade panel, and the site's feature-closing band and dusk's closing band, use
  it.
- **Utility**: `overlay` (the shadow tint at 34 to 64%) under sheets; `scrim` over locked
  previews; `artScrim` and `inkOnArt` for text over imagery in either scheme; `tintTrack` for
  empty progress and switch tracks; `glassTint`, `glassFallback` and `blurTint` for glass.

### Named Rules

**The One Hex Rule.** The accent is one hex in `brand.config.ts`. Every accent role is derived
from it, and `packages/brand/__tests__/contrast.test.ts` proves every text pair clears AA in all
four palettes across a spread of accents. Never hand-pick a tint, a hover or a text shade.

**The Roles Not Values Rule.** Colour is reached only by role: `--c-<role>` channel variables and
the Tailwind role utilities on the web (`bg-surface2`, `text-ink-secondary`,
`bg-brand text-on-brand`, `text-brand-ink`), the palette from `useTheme()` / `makeStyles` in the
app. No hex or `rgb()` literal outside `packages/brand`; the app's test fails on one.

**The Ink Not Fill Rule.** Accent text and icons on a ground use `brandInk`, never `brandFill`;
text on an accent fill uses `onBrand`. On dusk the two coincide by luck of the default hue, and
code must not rely on it.

## Typography

**Display Font:** Source Serif 4 on dusk (Georgia, serif fallback); Bricolage Grotesque on
daylight (system sans fallback). Both carry the optical-size axis on the web.
**Body Font:** Inter on both presets, for everything the reader operates.

**Character:** Dusk pairs an editorial serif, set at 600 with quiet negative tracking and air
for its ascenders, with a neutral Inter. Daylight sets a heavy grotesque at 800, tracked tight
and packed dense (line height under 1 on the web), over the same Inter one weight heavier in
labels, so the warm world reads confident.

### Hierarchy

The role scale lives in the preset (`theme.type`); the frontmatter holds it at app size. The web
takes family, weight and tracking from the same roles (`--type-<role>-*`) and sets its own sizes.

- **Display hero** (dusk 600 / daylight 800): the site's first headline only. Web
  `clamp(2.75rem, 1.55rem + 4.95vw, 6rem)`, line height 1.02 dusk / 0.94 daylight. Split into
  words that rise out of clipped lines.
- **Display** (dusk 600 / daylight 800; app 40pt): the app's welcome and upgrade headlines; the
  site's section leads, story acts and closing line at `clamp(2.1rem, 1.3rem + 3.3vw, 4.4rem)`.
- **H1** (app 32 / 30pt): pushed-screen titles. Web `clamp(2rem, 1.35rem + 2.4vw, 3.35rem)` at
  line height 1.1 dusk / 1.02 daylight: section headings, page titles.
- **H2** (web only as `.t-h2`): `clamp(1.7rem, 1.2rem + 1.7vw, 2.6rem)`, set in the H1 role's
  family, weight and tracking (so daylight's is 800, not the scale's 700).
- **Title** (26pt): the app's tab-screen masthead ("Good evening, Avery").
- **Question** (dusk serif 400 at 28 / daylight 700 at 26): onboarding questions only.
- **H3** (dusk 600 at 20 / daylight 700 at 19): card and section titles, sheet titles. Web
  `clamp(1.2rem, 1.05rem + 0.45vw, 1.45rem)` at line height 1.2.
- **Lead** (Inter 400, 18pt / web `clamp(1.075rem, 1rem + 0.35vw, 1.25rem)` at 1.55): the line
  under a headline. Measures 36 to 44ch on the web.
- **Body** (Inter 400, 16/24) and **Body small** (14/20): reading copy. Web body tracks -0.006em;
  legal prose runs 17px at 1.7 in a 68ch column; FAQ answers cap at 60ch.
- **Label** (Inter 600 dusk / 700 daylight, 15/20): buttons, row titles, anything tapped.
- **Caption** (Inter 400 dusk / 500 daylight, 13/18): metadata, hints, tab labels (at 11/14).
- **Number** (Inter 600 dusk / 800 daylight, 32/36, tabular): stats, prices, codes.
- **Tracked caps** (`eyebrow`, Inter 11/16, +0.14em dusk / +0.12em daylight, uppercase): field
  labels, list section headers, and a line that carries information (a date, "Step 2 of 2").

### Named Rules

**The Role Scale Rule.** Type is set by role (`<Text variant="h3">`, `.t-h1`, `type('label')`),
never by a size typed at the call site. A role caps OS font scaling at its `maxScale` (display 1.2
to body 2.0), so display type survives Dynamic Type without clipping and body text keeps scaling.

**The Set Breaks Rule.** Web headlines are passed as line arrays (`WordRise lines`, `Lines`) and
break at their clauses. The display face is not preloaded, so it swaps in after first paint; set
breaks keep the swap from re-wrapping the headline and shifting the layout.

**The Tabular Rule.** Every number that can change (prices, counters, codes, timers,
percentages) uses tabular figures.

## Layout

**Shared.** One 4-point scale on both surfaces and both presets (2, 4, 6, 8, 12, 16, 20, 24, 32,
40, 48, 64, 80). Touch targets are at least 44pt. A preset never changes spacing or layout.

**App.** Tab screens pad 20pt at the sides; onboarding, the paywall and forms pad 24pt. A screen
(`Screen`) owns the ground, the gutter and the clearance at each end: the status bar or a
`PageHeader` at the top, and at the bottom either the home indicator plus 28pt or the floating
tab bar's full clearance (bar, gap and 20pt of air). Content blocks stack with a 14 to 16pt gap.
The onboarding call to action floats over the step, which scrolls under it through a 56pt fade to
the ground, never a hard edge.

**Web.** Content sits in a 1120px column (`layout.maxContent`, Tailwind `max-w-content`) with 20px gutters, 32px from 640px up. Sections breathe
at 112px vertical padding, 144px from 640px. The fixed nav floats 12px from the top; in-page
anchors clear it by 5.5rem. Breakpoints are Tailwind's (sm 640, md 768, lg 1024, xl 1280), and
the site is designed at 1440 × 900 and 390 × 844.

- **Hero:** a two-column grid at `1.12fr 0.88fr` from lg (the copy takes about 56%), at least one
  full small viewport tall. Headline, one-line promise and the two store buttons sit above the
  fold at both design sizes. The phone sits right, at 320px wide from xl (300 lg, 292 sm, 258
  base).
- **Story:** from lg, a 12-column grid inside a sticky full-height stage; the section is
  `4 × 85vh + 40vh` tall, so each act gets 85% of a viewport of scroll and the last can be read
  before the pin releases. Copy spans 6 columns, the phone (290 to 310px) the other 6. Below lg
  the same acts become a stack of panes, two up from 640px, with no pinning.
- **Features:** a descent, not a grid. One display-size claim, two panes side by side from 768px,
  then one full-width hero band (`1.1fr 0.9fr` from lg) that closes the run.
- **Pricing:** heading left and one line of reassurance right, then three plan cards in a row
  from lg.
- **FAQ:** `0.8fr 1.2fr`, the heading and a support link beside the list.
- **Closing band:** full bleed; copy left, the phone (280 to 310px) right, running off the band's
  bottom edge and fading out through a mask.

### Named Rules

**The Same Structure Rule.** `dusk:` and `daylight:` variants restyle material (glow or field,
grain strength, weight) and may swap decorative, `aria-hidden` scenery (dusk's receding second
phone, daylight's ink chip). They never change readable content, its order, or the layout.

## Elevation & Depth

Depth is lightness first and shadow second. On dark grounds each tier sits one step lighter on
the ladder; on light grounds cards sit on near-white above a slightly darker paper. Shadows are
tinted with the palette's `shadowTint` (midnight on dusk, cool slate on dawn, warm umber on
daylight, near-black brown on espresso), never plain black, and dusk's are longer and softer than
daylight's.

### Shadow Vocabulary

Values are the primary schemes; the dark and light alternates use the same geometry with their
own tint and opacity (see the sidecar).

- **Soft** (dusk `0 2px 8px 0px rgba(2,4,13,0.3)`; daylight `0 2px 8px 0px rgba(81,54,34,0.07)`):
  small raised things: the segmented thumb, the logo mark, a scheme preview.
- **Card** (dusk `0 6px 18px -4px rgba(2,4,13,0.42)`; daylight `0 4px 16px -4px rgba(81,54,34,0.1)`):
  panes and raised cards.
- **Raised** (dusk `0 12px 28px -8px rgba(2,4,13,0.5)`; daylight `0 10px 26px -8px rgba(81,54,34,0.14)`):
  the hero card, the tab bar, the contracted nav, the featured plan.
- **Overlay** (dusk `0 18px 44px -12px rgba(2,4,13,0.6)`; daylight `0 16px 40px -10px rgba(81,54,34,0.2)`):
  the phone, the mobile menu, daylight's ink chip.
- **CTA** (dusk `0 8px 18px -6px rgba(2,4,13,0.45)`; daylight `0 6px 18px -6px rgba(81,54,34,0.24)`):
  primary buttons and the store pills. Android uses the matching `elevation` (1, 3, 6, 12, 4).

### Materials

- **Grain.** A fractal-noise layer over grounded sections: film grain on dusk (30%, soft-light),
  paper tooth on daylight (20%, multiply).
- **Pane.** Surface, soft border, card shadow; on dark schemes it adds a top-lit edge (an inset
  1px line of `borderGlass` and a glass gradient fading out by 42% of its height).
- **Glass.** Blur plus `glassTint` plus a glass or soft border: the app's tab bar and the site's
  contracted nav. Android gets `glassFallback`, a solid surface, because blur there is costly and
  uneven.
- **Light.** Dusk's accent as a radial wash (`brandGlow`), placed off-centre and fading to nothing
  inside its box. Daylight's accent as a field: a solid `brandFill` slab the phone stands on,
  running off the page edge, its leading side rounded at the `4xl` radius (40px).

### Named Rules

**The Ladder First Rule.** A surface gets its depth from its ladder step before any shadow.
Shadow alone never makes a tier.

**The Paint the Ground Rule.** A grained section paints its own ground (`bg-bg`, `bg-hero`,
`bg-brand`). Grain blended over transparency lifts the midnight toward slate instead of texturing
it.

**The Light Not Halo Rule.** The accent's glow is atmosphere in a room, placed off-centre and
wide, and never a ring or halo hugging an element. The old `shadow-glow` utility now resolves to
the tinted CTA shadow.

## Shapes

Corners are asked for by role (`button`, `input`, `row`, `card`, `sheet`, `chip`), never by
size, so each preset draws its own form. Dusk is round: pill buttons, 20px cards, 28px sheets.
Daylight is squarer and bigger-cornered on containers: 16px buttons, 24px cards, 32px sheets.
Chips, status badges, the tab bar, the segmented control and the store pills are pills on both.
A button's radius is capped at half its height.

- **Borders** are hairlines: `StyleSheet.hairlineWidth` in the app, 1px at alpha on the web.
  Focused and selected fields step up to 1.5px in `brandInk`.
- **The phone** is a real iPhone proportion (393 × 852). Its screen radius is 14% of the screen
  width and its bezel 3.4%, in `shadowTint` on dark grounds and `textPrimary` on light, with a
  Dynamic Island placed in percentages so it sits right over a real screenshot too.
- **The logo mark** is a rounded square at about 30% of its size with the name's initial in
  `onBrand`: the brand gradient in the app and on the phone, a flat `brandFill` in the site's nav,
  footer and favicon (`🎨 REPLACE` with the play's logo).
- **Daylight's field** is rounded only on its leading side, at the `4xl` radius (the top side on
  the stacked story panes); the rest runs off the page or the pane.

## Components

### Shared: the phone is the app

The website draws the app's screens in HTML (`apps/web/src/components/device/`), laid out in app
points on a 393 × 852 canvas that CSS scales to `--screen` px with no JavaScript. Each HTML part
in `device/parts.tsx` is a twin of an app primitive and reads the same role scale:

| App (`apps/mobile/components`)               | Web twin (`device/parts.tsx`)    |
| -------------------------------------------- | -------------------------------- |
| `ui/Button` (primary gradient, arrow disc)   | `AppButton`                      |
| `ui/Card` (standard, well, selected, hero)   | `AppCard`                        |
| `ui/Marks` `ProgressBar`, `Glow`, `LogoMark` | `ProgressBar`, `Glow`, `AppMark` |
| `ui/StatusBadge`                             | `StatusBadge`                    |
| `ui/IconButton`                              | `IconDisc`                       |
| `ui/SelectionRow`                            | `SelectionRow`                   |
| `TabBar` (floating glass pill, sliding lens) | `TabBar`                         |

The four screens (`WelcomeScreen`, `OnboardingScreen`, `HomeScreen`, `PaywallScreen`) mirror
`app/index.tsx`, `app/(onboarding)`, `app/(tabs)/index.tsx` and `app/upgrade.tsx`, filled with
sample content marked `🎨 REPLACE`: the greeting's name and the home stats are the app's
development demo data (`lib/mockData.ts`), and the item and activity rows are samples, since the
app lists those from the API. `<DeviceFrame src>` swaps any of them
for a real 1179 × 2556 screenshot.

**The Twin Rule.** When an app primitive or one of those four screens changes shape, its twin
changes in the same pull request. The phone on the site is the app, not a drawing of it.

### Web surface (`apps/web`)

**Capsule nav.** One DOM with two states. At the top of the page: a transparent, full-width bar
(`max-w-content`, 56px tall: `layout.navHeight`). Past 24px of scroll it contracts on the slow
duration into a floating glass capsule
(max 880px, pill, `bg` at 75% with a 24px backdrop blur, glass border, raised shadow). The
wordmark sets the site name in the display face beside the mark; four links sit centred
(`text-ink-secondary`, a `surface2` pill on hover, `text-ink` when current). The call to action
is an ink pill (40px, `bg-ink text-ink-inverse`) whose label follows the launch state. Below
768px the links fold into a `<details>` menu that opens before hydration: a 44px round glass
trigger and a pane dropping from the top right.

**Store pills.** The page's primary action, in both presets: 56px ink pills (the inverse of the
ground: near-white on dusk, graphite on daylight) with the store glyph, a small "Download on the"
line at 75% and the store name at 17px semibold. They read on the page, on the marigold field and
on the dusk band alike. Each leans up to 7px toward a mouse cursor on the snappy spring
(`Magnetic`), presses to 0.96, and drops out when its URL in `src/lib/stores.ts` is empty.

**Waitlist form.** The pre-launch replacement for the store pills. One field and one ink button
in a single surface pill (a 28px-cornered stack below 640px), soft shadow, a 2px `borderFocus`
ring while focused. Success replaces the form with a status line and a `brandInk` check.

**The phone (`DeviceFrame`).** See Shapes. Sized only by `--screen`; never stretched by a flex or
grid parent. A faint top-lit glass sheen crosses the display. Labelled as an image for screen
readers, or hidden when it is scenery.

**Hero.** Word-rise headline, lead, store pills (or the waitlist). The phone rests in a
three-quarter turn from lg (`rotateY(-9deg) rotateX(3deg)`; flat and sharp below lg, because a 3D
turn rasterises the scaled screen soft on a phone), leans up to 6° toward the mouse on the gentle
spring, and drifts 90px down and 3° round over the first 900px of scroll on the smooth spring.
Dusk: the phone stands in the accent's wash under grain, with the onboarding screen on a second
phone receding behind it at 84% scale and 55% opacity. Daylight: it stands on a marigold field
that runs off the right edge, with one ink chip riding the field's edge.

**Story (`SceneScroll`).** Four acts dealt onto one pinned phone. One index, the section's scroll
progress floored into four, decides every act's `data-state` (past, active, future), and CSS
does the choreography:

- A screen is **dealt**: the incoming one rises from 4% low and 3.5% too close out of a 5px blur
  and lands on top over `--dur-deal` (the slow duration × 1.35); the outgoing one waits half a
  beat, settles back to 98.5% and defocuses underneath.
- Copy **never crossfades**: the outgoing act leaves first (28px up, faded), and the incoming
  heading wipes up from a clip edge after a 40% base-duration delay.
- The **camera** is the only thing tied to every frame of scroll: the phone turns from -2.5° to
  1.5°, pushes in from 95% to 100% and rises 32px across the whole story, on the smooth spring.
- The **light** moves with the acts. Dusk: the wash (`.act-light`) glides to each act's position
  and strength over 1.4 × the deal duration, on the in-out ease. Daylight: the marigold field
  (`.act-field`) deepens act by act (strength 0.66, 0.8, 0.9, 1; the dusk wash brightens on the
  same steps) and carries the act's numeral (7rem, 10rem from xl) and
  name in `onBrand` ink, the story's one counter on that preset. On dusk the counter is a line
  under the copy (`02 · Make it yours`, the numeral in `brandInk`), beside a row of dots whose
  active dot stretches to 28px.

Below lg each act is a pane: its number and name, a 230px phone on a small wash (dusk) or field
(daylight) that fades out before the pane's edge, then the act's title and body.

**Feature descent and vignettes.** Features are shown, not claimed. Each pane holds a small
piece of the app's own UI doing the job: an OTP row whose digits type into place once revealed
(the last box focused in `brandInk` with a `brandDim` ring), the two schemes side by side in their
own palettes above a System / Light / Dark switch, and the settings group where "Delete account"
sits in the error soft tint. The run ends on a hero-surface band under grain with the settings
vignette in a dark-scheme well; on dusk a wash of the accent falls from its top corner, on
daylight the band carries no glow (daylight lights with fields, never glows).

**Plan cards.** One shape for every plan: surface, soft border, soft shadow, the name in h3, the
price in the number role at 3rem, features with `brandInk` checks. The featured plan is marked by
material, never a badge: on dusk it steps to `surface2` with a `brandBorder` edge, a raised
shadow and a gradient hairline of `brandInk` across its top; on daylight it is the marigold field
with `onBrand` text. A placeholder price wears a dashed "Placeholder price" pill until
`src/lib/pricing.ts` has a real one. On `/pricing`, each card ends in a `rounded-button` action:
the featured one filled (`bg-brand` on dusk, ink on daylight), the others outlined.

**FAQ.** `<details>` rows between soft rules, so they open before hydration and by keyboard. The
question at 17px semibold turns `brandInk` on hover; a 36px round plus icon rotates 45° and fills
with `brandDim` when open; the answer arrives with the base entrance.

**Closing band.** Owns the full width. Dusk: the hero surface rising out of the page's ground,
under grain, lit from below by a wide blurred wash. Daylight: the marigold field with graphite
ink. Copy and the store pills (or the waitlist) on the left, the app's welcome screen rising into
the band from its bottom edge on the right. Its copy follows the launch state.

**Footer and pages.** The footer sits on the ground under a hairline: mark and one-liner, then
three link columns at 14px (`text-ink-secondary`, `text-ink` on hover). Inner pages open with the
display-face title (`PageHeader`) and a lead; legal pages use `Prose`.

**Web motion.**

- **Entrances are CSS**, so the first viewport never waits on hydration. Words rise out of their
  own clipped lines (from 130% below) one stagger step apart over `--dur-rise` (the slow duration
  × 1.45); dusk dissolves each word out of an 8px blur, daylight rises crisp. `.enter` fades up
  by `--rise`, with a 10px blur on dusk. The hero promise has no entrance, so the largest text
  block on a phone paints at once.
- **Scroll reveals** use one IntersectionObserver per element (firing as the top edge crosses 8%
  above the viewport bottom) and CSS: a rise of 2 × `--rise`, plus a 10px blur on dusk. An element
  is hidden only while a script will reveal it, never without JavaScript or under reduced motion.
- **Springs** (Motion) come from the preset through `<MotionProvider>`, which also sets
  `reducedMotion="user"`.

### App surface (`apps/mobile`)

**Text.** The only place React Native's `Text` is imported. `variant` applies a role, `tone`
picks a text colour by role (`secondary`, `brand`, `onBrand`, `error`…), and a `fontWeight`
becomes the matching loaded family (Android otherwise falls back to Roboto silently). Font
padding is off so iOS and Android line boxes match.

**Eyebrow.** Tracked caps (the `eyebrow` role) led by the three-dot mark (the middle dot full,
the outer two at 55%), in `brandInk` or, muted, tertiary. It carries information the heading does
not: the date above the home greeting, the step count above an onboarding question ("Step 2 of
2"), a section head ("How the free trial works"). It is not a title kicker: a caps line that only
restates or announces the heading under it is cut. The website's twin is `Eyebrow` in
`device/parts.tsx`, used only inside the phone.

**Buttons.** Three heights: 40, 50 and 56pt. Primary paints `brandGradient` with `onBrand`
label text and the CTA shadow; the large primary can carry a 40pt `onBrand` disc with an arrow on
its trailing edge (the hero call to action). Secondary is `brandDim` with a `brandBorder` and
`brandInk` text; outline is an active border with primary text; ghost is secondary text alone;
destructive is the error soft tint with error text. Disabled is a calm `well` with tertiary
text, never a faded brand button, and can stay tappable to refuse (a 6pt shake and the warning
haptic, with a line saying what is missing). Loading keeps the size and swaps the label for a
spinner. Corners come from the preset's `button` radius.

**Cards.** Five tiers: standard (`surface`, hairline), raised (`surface2`, card shadow; the card
that leads a screen), well (sunken, no border), selected (`brandDim` with `brandBorder`) and hero
(the always-dark surface, raised shadow). Padding 0, 12, 18 or 24pt; a pressable card springs to
0.98.

**Press.** Every tappable goes through `PressableScale`: down on the snappy spring on press-in,
back on the settle spring on release, with a haptic named for its meaning (`press`, `select`,
`snap`, `refresh`, `success`, `warning`, `error`). Icons and tabs press deeper (0.9). Haptics
honour the in-app switch in Settings and are silent on the web.

**Tab bar.** A 64pt floating pill, 4pt above the home indicator and inset by the 20pt gutter:
real blur plus `glassTint` on iOS and the web, `glassFallback` on Android, a glass border on dark
and a soft one on light, raised shadow. The active tab sits in a `brandDim` lens that slides on
the smooth spring; the active icon and label take `brandInk`, the rest tertiary. A tab change
ticks the select haptic.

**Sheets and modals.** Built on React Native's `Modal`. The sheet is `surface` with the `sheet`
radius on its top corners and a hairline; it fades and rises in on `modalIn` and out on
`modalOut`, never a springy push. Drag the handle a quarter of the way down, or fling it, to
dismiss; otherwise it settles back on the settle spring. The backdrop is `overlay`, with a light
blur on iOS.

**Inputs.** A 52pt field on `well` with the `input` radius, a tracked-caps label above and a
caption below. Focus draws a 1.5pt `brandInk` border and tints the leading icon; an error draws
`errorText` and says what is wrong. The keyboard follows the scheme. The one-time code uses its
own boxed digits in the same language.

**Choice.** `SegmentedControl`: a pill `well` track with a raised thumb (`surface3` on dark,
`surface` on light) that slides on the smooth spring. `SelectionRow`: a 72pt row with a 24pt ring
that fills with `brandInk` and a check when chosen, the row turning `brandDim` with a `brandInk`
border. `Toggle` for on and off.

**Status and progress.** `StatusBadge`: a pill of the semantic soft tint with its text colour
and a dot, so state never rides on colour alone. `ProgressBar`: `brandInk` filling a `tintTrack`
on the smooth spring. `NumberTicker` ticks a stat to its new value in tabular figures (and
simply shows it under reduced motion). `Skeleton` blocks shimmer on `shimmer` with
a `shimmerSweep`. `EmptyState` and error states replace lists, never an empty list for a failure.

**Onboarding shell.** Back and Skip in a top bar with progress dots between them (the current dot
stretches to 22pt and fills with `brandInk`, all driven by one value so neighbours ease
together); the step's content; and a floating large primary with an arrow that the content
scrolls under. A second tap within a second is ignored.

**Welcome.** A glow washing down from the top, the mark and the name, three cards of sample UI
dealt onto the table on the gentle spring 90ms apart then left breathing (a 5pt float on a
4.4s in-out cycle), the tagline rising word by word in the display role, and one way forward.

**App motion.** Tab screens and first-run surfaces enter block by block with `FadeSlideIn` /
`enter(i)` (the preset's stagger, capped). A pushed screen's title never animates: the navigation
transition is its entrance, and a nested entrance flashes on the way back. Lists move with
`layoutTransition` on the smooth spring.

## Do's and Don'ts

### Do:

- **Do** rebrand in `packages/brand/brand.config.ts` only: the preset, one accent hex, the names.
  After a preset change, set the native splash and adaptive-icon background in
  `apps/mobile/app.json` to the new ground.
- **Do** reach every colour by role: `bg-surface2`, `text-ink-secondary`, `bg-brand text-on-brand`,
  `text-brand-ink` on the web; `c.surface`, `c.brandInk` from `useTheme()` in the app.
- **Do** use `brandInk` for accent text, icons, links and focus, and `onBrand` for anything on an
  accent fill or the brand gradient.
- **Do** give each view one bright accent moment: the hero field or wash, the featured plan, the
  closing band. Elsewhere the accent is ink.
- **Do** paint the ground (`bg-bg`, `bg-hero` or `bg-brand`) on any section that carries grain.
- **Do** set type by role (`variant`, `.t-*`, `type()`), and tabular figures on every number that
  changes.
- **Do** pick one of the four named springs and the preset's easings and durations for new motion,
  and give it a reduced-motion state that keeps only what carries meaning.
- **Do** change a web twin in `device/parts.tsx` or `device/screens/*` in the same pull request as
  the app primitive or screen it mirrors.
- **Do** mark anything a play must change with `🎨 BRAND` or `🎨 REPLACE`, and keep placeholders
  looking like placeholders: prices from `src/lib/pricing.ts` with their dashed pill, demo data
  labelled as demo data.
- **Do** let `src/lib/stores.ts` decide live or pre-launch: store pills and "Get the app" once a
  store URL is set, the waitlist and "Be first in line" while both are empty.

### Don't:

- **Don't** write a hex or `rgb()` value outside `packages/brand`, and don't hand-pick an accent
  tint, hover or text shade; derive it.
- **Don't** put `brandFill` on text over a ground; on paper it fails AA.
- **Don't** draw a glow as a halo or ring around a button, card or phone; the wash is off-centre
  atmosphere that fades to nothing inside its box.
- **Don't** cast a shadow in plain black, or make a tier with shadow alone.
- **Don't** use `dusk:` or `daylight:` to change readable content, its order or the layout; they
  restyle material and swap decorative scenery only.
- **Don't** crossfade two headings; the outgoing copy leaves before the incoming arrives.
- **Don't** tune a one-off spring, use a linear ease, or add bounce.
- **Don't** set gradient text; emphasis comes from colour and weight (`.text-gradient` survives
  only as a compatibility alias for `brandInk`).
- **Don't** mark the featured plan with a badge; mark it with material.
- **Don't** animate a pushed screen's title in the app, or gate the web's first viewport on
  hydration.
- **Don't** invent prices, ratings, testimonials or metrics; the template has none.
