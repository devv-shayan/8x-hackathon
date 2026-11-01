import type { Metadata } from 'next'
import { PageHeader, PageShell } from '@/components/PageShell'
import { Container } from '@/components/Container'
import { DeleteAccountForm } from '@/components/DeleteAccountForm'

export const metadata: Metadata = {
	title: 'Delete your account',
	description: 'Permanently delete your account and associated data.'
}

const IN_APP_STEPS = [
	<>
		Open the app and go to <strong>Profile → Settings</strong>.
	</>,
	<>
		Tap <strong>Delete account</strong>.
	</>,
	<>Confirm. Your account and data are removed immediately.</>
]

// Google Play and the App Store require this page: keep it reachable and accurate.
export default function DeleteAccountPage() {
	return (
		<PageShell>
			<Container className="pb-28 sm:pb-36">
				<div className="mx-auto max-w-2xl">
					<PageHeader
						label="Account"
						title="Delete your account"
						lead="You can permanently delete your account and all the data in it at any time."
					/>

					<div className="mt-12 border border-[rgb(var(--l-hair))]">
						<section className="p-6 sm:p-8" aria-labelledby="in-app-heading">
							<h2 id="in-app-heading" className="l-mono">
								From inside the app (fastest)
							</h2>
							<ol className="mt-5">
								{IN_APP_STEPS.map((step, i) => (
									<li
										key={i}
										className="flex gap-4 border-t border-[rgb(var(--l-hair-soft))] py-3 first:border-t-0 [&_strong]:font-medium"
									>
										<span className="l-mono pt-0.5 text-[rgb(var(--l-ink))]">
											{String(i + 1).padStart(2, '0')}
										</span>
										<span className="text-[rgb(var(--l-muted))] [&_strong]:text-[rgb(var(--l-ink))]">
											{step}
										</span>
									</li>
								))}
							</ol>
						</section>

						<section
							className="border-t border-[rgb(var(--l-hair))] p-6 sm:p-8"
							aria-labelledby="request-heading"
						>
							<h2 id="request-heading" className="l-mono">
								Can&rsquo;t sign in?
							</h2>
							<p className="mt-2 text-[rgb(var(--l-muted))]">
								Enter the email on your account and we&rsquo;ll process the deletion and confirm by
								email.
							</p>
							<div className="mt-5">
								<DeleteAccountForm />
							</div>
						</section>

						<section
							className="border-t border-[rgb(var(--l-hair))] bg-[rgb(var(--l-wash))] p-6 sm:p-8"
							aria-labelledby="what-heading"
						>
							<h2 id="what-heading" className="l-mono">
								What gets deleted
							</h2>
							<p className="mt-2 text-pretty leading-relaxed text-[rgb(var(--l-muted))]">
								Your profile, content, and usage records are permanently removed. Subscription
								billing history retained by Apple/Google is governed by their policies. Anonymized
								analytics that can no longer identify you may be retained.
							</p>
						</section>
					</div>
				</div>
			</Container>
		</PageShell>
	)
}
