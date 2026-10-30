import type { Metadata } from 'next'
import { PageHeader, PageShell } from '@/components/PageShell'
import { Container } from '@/components/Container'
import { DeleteAccountForm } from '@/components/DeleteAccountForm'

export const metadata: Metadata = {
	title: 'Delete your account',
	description: 'Permanently delete your account and associated data.'
}

// Google Play and the App Store require this page: keep it reachable and accurate.
export default function DeleteAccountPage() {
	return (
		<PageShell>
			<Container className="pb-28 sm:pb-36">
				<div className="mx-auto max-w-2xl">
					<PageHeader
						title="Delete your account"
						lead="You can permanently delete your account and all the data in it at any time."
					/>

					<section className="pane mt-12 p-7 sm:p-8" aria-labelledby="in-app-heading">
						<h2 id="in-app-heading" className="t-h3">
							From inside the app (fastest)
						</h2>
						<ol className="mt-5 space-y-2.5 text-ink-secondary [&_li]:ml-5 [&_li]:list-decimal [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink">
							<li>
								Open the app and go to <strong>Profile → Settings</strong>.
							</li>
							<li>
								Tap <strong>Delete account</strong>.
							</li>
							<li>Confirm. Your account and data are removed immediately.</li>
						</ol>
					</section>

					<section className="pane mt-5 p-7 sm:p-8" aria-labelledby="request-heading">
						<h2 id="request-heading" className="t-h3">
							Can&apos;t sign in?
						</h2>
						<p className="mt-2 text-ink-secondary">
							Enter the email on your account and we&apos;ll process the deletion and confirm by
							email.
						</p>
						<div className="mt-6">
							<DeleteAccountForm />
						</div>
					</section>

					<section className="mt-10 px-1" aria-labelledby="what-heading">
						<h2 id="what-heading" className="font-sans text-base font-semibold text-ink">
							What gets deleted
						</h2>
						<p className="mt-2 text-pretty leading-relaxed text-ink-secondary">
							Your profile, content, and usage records are permanently removed. Subscription billing
							history retained by Apple/Google is governed by their policies. Anonymized analytics
							that can no longer identify you may be retained.
						</p>
					</section>
				</div>
			</Container>
		</PageShell>
	)
}
