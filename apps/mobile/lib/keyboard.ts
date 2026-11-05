/**
 * `KeyboardAvoidingView` only moves a screen when `behavior` is set. `padding`
 * adds the overlap under the focused field. The overlap is measured against
 * the view, so a window the system already resized reports none and the
 * padding stays 0. The same value is right on iOS and Android.
 */
export const KEYBOARD_LIFT = 'padding' as const
