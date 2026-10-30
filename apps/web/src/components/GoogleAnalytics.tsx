'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/**
 * Google Analytics 4 via gtag.js. No-ops when NEXT_PUBLIC_GA_ID is unset.
 * Loads the script once and sends a `page_view` on every client-side route
 * change (App Router doesn't fire a full page load between routes).
 */
export function GoogleAnalytics() {
	const pathname = usePathname()
	const searchParams = useSearchParams()

	useEffect(() => {
		if (!GA_ID || typeof window === 'undefined') return
		const w = window as unknown as { gtag?: (...args: unknown[]) => void }
		if (typeof w.gtag !== 'function') return
		const search = searchParams?.toString()
		const path = pathname + (search ? `?${search}` : '')
		w.gtag('event', 'page_view', { page_path: path, page_location: window.location.href })
	}, [pathname, searchParams])

	if (!GA_ID) return null

	return (
		<>
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
				strategy="afterInteractive"
			/>
			<Script id="ga4-init" strategy="afterInteractive">
				{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
			</Script>
		</>
	)
}
