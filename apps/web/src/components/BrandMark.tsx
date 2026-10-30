import { cn } from '@/lib/utils'

/**
 * The site's mark: its initial on the brand fill, the same drawing as the
 * favicon (src/app/icon.tsx). 🎨 REPLACE with the play's real logo.
 */
export function BrandMark({ siteName, className }: { siteName: string; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				'grid h-8 w-8 place-items-center rounded-[9px] bg-brand font-display text-[17px] font-bold text-on-brand',
				className
			)}
		>
			{siteName.charAt(0).toUpperCase()}
		</span>
	)
}
