import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/Container'
import { PageHeader, PageShell } from '@/components/PageShell'
import { PRIMARY_BUTTON } from '@/components/formStyles'
import { PixelStudents } from '@/components/landing/pixel/PixelStudents'

export const metadata: Metadata = { title: 'Page not found' }

const LOST: readonly [string, string] = [
	'Wait, where did this page go?',
	'There’s nothing at this address. Check the link.'
]

export default function NotFound() {
	return (
		<PageShell>
			<Container className="grid items-center gap-12 pb-28 sm:pb-36 lg:grid-cols-[1fr_1.05fr]">
				<div>
					<PageHeader
						label="404"
						title="This page isn’t in the class."
						highlight="isn’t"
						lead="The link may be old, or the address mistyped."
					/>
					<div className="mt-8 flex flex-wrap gap-2">
						<Link href="/" className={PRIMARY_BUTTON}>
							<span aria-hidden="true">&gt;</span>
							Back to the home page
						</Link>
						<Link
							href="/support"
							className="inline-flex min-h-11 items-center gap-2 bg-[rgb(var(--l-wash))] px-5 text-sm hover:bg-[rgb(var(--l-hair))]"
						>
							<span aria-hidden="true">&gt;</span>
							Get help
						</Link>
					</div>
				</div>
				<PixelStudents
					questions={LOST}
					className="aspect-[4/3] w-full border border-[rgb(var(--l-hair))]"
				/>
			</Container>
		</PageShell>
	)
}
