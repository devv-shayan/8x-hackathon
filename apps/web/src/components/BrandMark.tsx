import { cn } from '@/lib/utils'

/**
 * The site's mark: a 3x3 block of pixels with one lime cell, a student's raised hand. Drawn
 * from the same pixels as the landing page's backgrounds.
 */
const CELLS = ['ink', 'ink', 'ink', 'ink', 'off', 'off', 'ink', 'ink', 'lime'] as const

export function BrandMark({ className }: { className?: string }) {
	return (
		<span aria-hidden="true" className={cn('grid grid-cols-3 gap-px', className)}>
			{CELLS.map((cell, i) => (
				<span
					key={i}
					className={cn(
						'h-[5px] w-[5px]',
						cell === 'ink' && 'bg-[rgb(var(--l-ink))]',
						cell === 'lime' &&
							'bg-[rgb(var(--l-lime))] outline outline-1 outline-[rgb(var(--l-ink))]'
					)}
				/>
			))}
		</span>
	)
}
