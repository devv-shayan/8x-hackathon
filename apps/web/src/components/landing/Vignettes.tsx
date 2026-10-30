import { Bell, ChevronRight, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { cn, type CssVars } from '@/lib/utils'

/*
 * Small pieces of the app's own UI, drawn from the same tokens, that show a
 * feature doing its job instead of an icon standing in for it.
 * 🎨 REPLACE: sample values (the code, the address).
 */

const CODE = ['4', '8', '2', '9', '1', '7']

/** Sign in with a code: six boxes filling in, the last one still focused. */
export function OtpVignette() {
	return (
		<div aria-hidden="true">
			<p className="text-sm text-ink-secondary">
				Enter the code we sent to <span className="font-medium text-ink">you@example.com</span>
			</p>
			<div className="mt-4 flex gap-2 sm:gap-2.5">
				{CODE.map((digit, i) => (
					<span
						key={i}
						className={cn(
							'grid h-14 min-w-0 max-w-12 flex-1 place-items-center rounded-input border bg-well sm:h-16',
							i === CODE.length - 1
								? 'border-brand-ink ring-[3px] ring-brand-dim'
								: 'border-line-soft'
						)}
					>
						<span className="otp-digit t-number text-2xl" style={{ '--i': i } as CssVars}>
							{digit}
						</span>
					</span>
				))}
			</div>
		</div>
	)
}

/** One scheme's miniature: the same card in that scheme's own palette. */
function SchemePreview({ scheme, label }: { scheme: 'light' | 'dark'; label: string }) {
	return (
		<div
			data-scheme={scheme}
			className="flex-1 rounded-2xl border border-line-soft bg-bg p-3 text-ink shadow-soft"
		>
			<div className="flex items-center gap-2">
				<span className="h-5 w-5 rounded-md bg-brand" />
				<span className="h-2 w-16 rounded-pill bg-ink/80" />
			</div>
			<div className="mt-3 space-y-1.5 rounded-xl bg-surface p-2.5">
				<span className="block h-1.5 w-4/5 rounded-pill bg-tint-track" />
				<span className="block h-1.5 w-3/5 rounded-pill bg-tint-track" />
				<span className="mt-2 block h-4 w-2/5 rounded-pill bg-brand" />
			</div>
			<p className="mt-2.5 text-xs font-medium text-ink-secondary">{label}</p>
		</div>
	)
}

const MODES = [
	{ icon: Monitor, label: 'System' },
	{ icon: Sun, label: 'Light' },
	{ icon: Moon, label: 'Dark' }
]

/** Light or dark: both of this preset's schemes side by side, and the switch. */
export function SchemeVignette({ lightName, darkName }: { lightName: string; darkName: string }) {
	return (
		<div aria-hidden="true">
			<div className="flex gap-3">
				<SchemePreview scheme="light" label={lightName} />
				<SchemePreview scheme="dark" label={darkName} />
			</div>
			<div className="mt-4 flex rounded-pill bg-well p-1">
				{MODES.map(({ icon: Icon, label }, i) => (
					<span
						key={label}
						className={cn(
							'flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-sm font-medium',
							i === 0 ? 'bg-surface text-ink shadow-soft' : 'text-ink-tertiary'
						)}
					>
						<Icon className="h-4 w-4" />
						{label}
					</span>
				))}
			</div>
		</div>
	)
}

const SETTINGS = [
	{ icon: Monitor, label: 'Appearance', value: 'System' },
	{ icon: Bell, label: 'Reminders', value: 'On' }
]

/** Leaving: the settings group where deleting the account lives. */
export function SettingsVignette() {
	return (
		<div aria-hidden="true" className="space-y-2">
			{SETTINGS.map(({ icon: Icon, label, value }) => (
				<div
					key={label}
					className="flex h-14 items-center gap-3 rounded-row border border-line-hairline bg-surface px-4"
				>
					<span className="grid h-8 w-8 place-items-center rounded-lg bg-surface3 text-ink-secondary">
						<Icon className="h-4 w-4" />
					</span>
					<span className="flex-1 text-[15px] font-medium">{label}</span>
					<span className="text-sm text-ink-tertiary">{value}</span>
					<ChevronRight className="h-4 w-4 text-ink-tertiary" />
				</div>
			))}
			<div className="flex h-14 items-center gap-3 rounded-row border border-error-border bg-error-soft px-4">
				<span className="grid h-8 w-8 place-items-center rounded-lg bg-error-soft text-error-text">
					<Trash2 className="h-4 w-4" />
				</span>
				<span className="flex-1 text-[15px] font-medium text-error-text">Delete account</span>
				<ChevronRight className="h-4 w-4 text-error-text" />
			</div>
		</div>
	)
}
