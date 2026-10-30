# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One visual language on iOS and Android, from the shared `packages/brand` presets. What adapts per OS
is behaviour, not look: the back gesture versus the hardware back button, haptics, sheet and
keyboard handling, safe areas, and store-specific purchase, restore and subscription-management
flows.

## Users

The end users of whichever play is built on this template (see the root `PRODUCT.md`). The template
serves them through a first-run path (welcome, onboarding, sign-in, paywall) and a signed-in app
(tabs, detail, profile, settings, support), all of which a play re-skins and re-fills.

## Capabilities and Constraints

- Expo SDK 55, expo-router, NativeWind, Reanimated 4, gesture handler, expo-blur,
  expo-linear-gradient, react-native-svg, expo-haptics, expo-image. There is no bottom sheet
  library: sheets are the app's own `components/ui/Sheet.tsx` on React Native's `Modal` (not
  @gorhom/bottom-sheet, which can mount invisibly under the New Architecture on Android). No native
  module is added for design work, so visual changes ship as OTA updates.
- Fonts load through `@expo-google-fonts/*` packages (JavaScript plus font files, no native code).
- Mock content is for development only; a production build shows loading and empty states, never
  fake data.
- The paywall, account deletion and permission prompts follow the store-review rules in the root
  record.
