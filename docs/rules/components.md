# Components and icons

Both apps have a small set of primitives. Add to them deliberately; don't pre-build a component
nobody uses yet, and don't reach for a new UI dependency when a primitive would do.

## Where they live

| App                     | Primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Everything else                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/mobile`           | `components/ui/`: `Text`, `Button`, `Card`, `ListRow` / `ListGroup` / `Section`, `PageHeader` / `ScreenTitle`, `Screen`, `SegmentedControl`, `Toggle`, `SelectionRow`, `Sheet`, `AppModal` (alert, action sheet), `EmptyState`, `Skeleton`, `CodeInput`, `TextInputField`, `StatusBadge`, `IconButton`, `Eyebrow`, `LogoMark` / `Avatar` / `ProgressBar` / `Glow` (`Marks.tsx`); `components/motion/`: `PressableScale`, `FadeSlideIn` / `StaggerList`, `NumberTicker` | `components/` (tab bar, onboarding shell, item card, offline banner and overlay) |
| `apps/web`              | No separate primitives: `src/components/` holds the site's sections and forms, `src/components/motion/` its motion helpers                                                                                                                                                                                                                                                                                                                                             | `src/components/`                                                                |
| Both (`packages/brand`) | Design tokens: colours, fonts, radii, and the web Tailwind preset                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                  |

## The conventions

- **Tokens only.** A colour, radius, font, shadow or spring comes from `packages/brand`: the
  web through its CSS variables, the app through `useTheme()` / `useColors()` / `makeStyles`.
  Never a hardcoded colour ([code style](code-style.md)).
- **Every tappable feels the same.** It is `PressableScale` or a primitive built on it (spring
  to .96, cards .98, with a meaning-named haptic from `lib/haptics.ts`); entrances use
  `lib/motion.ts`'s `enter(i)`, never on a pushed screen's title. Reduce Motion is honoured by
  the springs and timings themselves.
- **Use the primitive.** On mobile, text is `components/ui/Text` (it applies the app's
  typography), not a bare React Native `Text`; a button is `components/ui/Button`. A screen that
  restyles a raw primitive is how two screens drift apart.
- **Web: Server Components by default.** A component gets `'use client'` only when it uses a
  hook, a browser-only API, or an event handler that must run in the browser. Keep the client
  boundary as small as the interactivity.
- **No `forwardRef`.** React 19 (both apps) takes `ref` as a plain prop.
- **Accessibility is part of done.** On the web, an icon-only button has an `aria-label`; on
  mobile, a touchable without visible text has an `accessibilityLabel` and an
  `accessibilityRole`. A tap target is at least 44 × 44 points (48 dp on Android).

## Icons

Web uses `lucide-react`; the app uses `lucide-react-native` and `@expo/vector-icons`. Icons are
decorative: label the control, not the glyph. On the web an icon inherits `currentColor` from
its parent, so set colour on the parent; React Native has no such inheritance, so pass a colour
from the palette (`useColors()`), never a literal colour.

template-web routes every icon through one wrapper file (`@/components/ui/icons`) so a provider
swap is a one-file change, and bans direct provider imports with ESLint. This repo has no such
wrapper. If a play adds one, it follows that shape (one file per app imports the provider;
everything else imports the wrapper) and adds the ESLint ban with it.

## Mobile screens

- A screen is a route file under `apps/mobile/app/` (expo-router). It renders; data comes from
  a hook, logic from `lib/` ([code quality](code-quality.md)).
- Every screen handles loading, empty, failed and offline, each with its own UI
  ([error handling](error-handling.md)).
- New screens register their events first ([analytics](analytics.md)); `screen_viewed` is
  already emitted on every route change by the root layout.
