// The website's form controls: square, hairline-bordered, black when focused. Shared by the
// support and delete account forms so the two stay the same.

export const FIELD =
	'w-full border border-[rgb(var(--l-hair))] bg-[rgb(var(--l-paper))] px-4 py-3 text-[rgb(var(--l-ink))] placeholder:text-[rgb(var(--l-faint))] transition-colors duration-fast hover:border-[rgb(var(--l-faint))] focus-visible:border-[rgb(var(--l-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--l-lime))]'

const BUTTON =
	'inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-medium text-white transition-colors duration-fast disabled:opacity-60'

/** The square black button. */
export const PRIMARY_BUTTON = `${BUTTON} bg-[rgb(var(--l-ink))] hover:bg-[rgb(var(--l-ink)/0.85)]`

/** The square red button, for the one action that can't be undone. */
export const DANGER_BUTTON = `${BUTTON} bg-[rgb(var(--l-danger))] hover:bg-[rgb(var(--l-danger)/0.88)]`

/** A confirmation after a form is sent. */
export const SENT_NOTE =
	'flex items-center gap-2 border border-[rgb(var(--l-ink))] bg-[rgb(var(--l-lime-soft))] px-5 py-4 text-sm text-[rgb(var(--l-ink))]'

/** A form's error line. */
export const ERROR_NOTE = 'text-sm text-[rgb(var(--l-danger))]'
