import { Fragment } from 'react'
import type { CssVars } from '@/lib/utils'

/**
 * A headline whose words rise out of their own clipped line, one after the
 * next. A server component driven by CSS (`.word-rise` in globals.css): the
 * hero headline is the largest thing on the first paint and must not wait on
 * hydration. Dusk dissolves each word out of a blur; daylight rises crisp.
 *
 * Pass `lines` to set the display line breaks yourself. The display face is
 * not preloaded (only the preset's own face is ever downloaded), so it swaps
 * in after first paint; with set breaks the swap cannot re-wrap the headline,
 * which is what would otherwise shift the layout. A line still wraps if a
 * narrow screen needs it to.
 *
 * Screen readers get the sentence once, whole; the split words are hidden
 * from them so they are not read as separate fragments.
 */
export function WordRise({
	lines,
	as: Tag = 'span',
	className,
	delay = 0
}: {
	/** The headline, one entry per display line. */
	lines: string[]
	as?: 'h1' | 'h2' | 'p' | 'span'
	className?: string
	/** Milliseconds before the first word moves. */
	delay?: number
}) {
	let index = 0
	return (
		<Tag className={className}>
			<span className="sr-only">{lines.join(' ')}</span>
			<span aria-hidden="true">
				{lines.map((line, l) => (
					<span key={`${line}-${l}`} className="block">
						{line.split(' ').map((word, w, words) => {
							const i = index++
							return (
								<Fragment key={`${word}-${w}`}>
									<span className="rise-clip">
										<span
											className="word-rise"
											style={{ '--i': i, '--rise-delay': `${delay}ms` } as CssVars}
										>
											{word}
										</span>
									</span>
									{w < words.length - 1 ? ' ' : null}
								</Fragment>
							)
						})}
					</span>
				))}
			</span>
		</Tag>
	)
}
