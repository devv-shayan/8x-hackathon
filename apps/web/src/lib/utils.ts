import type { CSSProperties } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names, de-duping conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/** Inline styles that also set CSS custom properties (`{ '--i': 2 }`). */
export type CssVars = CSSProperties & Record<`--${string}`, string | number>
