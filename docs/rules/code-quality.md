# Code quality

The goal of every rule here is the same: keep the codebase predictable enough that an agent
(or a new engineer, on day one of a play) can extend it or fix a bug without first
reverse-engineering intent. Predictable structure and honest types do more for that than
documentation does.

These apply to both apps. `eslint.config.mjs` at the root holds one block per workspace;
`npm run lint` runs it over the whole tree.

## No `any`, no `as any`

`@typescript-eslint/no-explicit-any` is an error in `apps/web` and `apps/mobile`. `any` doesn't
just weaken the one value it touches: it silently switches off type checking on every
variable, parameter and return value downstream of it, with no further warning.

Use instead, in order of preference:

- **`unknown`** for a value of uncertain shape. It can't be used until narrowed, which forces a
  real runtime check.
- **Generics** to keep the relationship between an input and an output type.
- **A real type** for the actual shape.
- **`satisfies`** to check an object against a type without widening it.
- **Zod** to turn untrusted `unknown` (a request body, an API response, `JSON.parse`) into a
  typed value at the boundary ([code style](code-style.md)).

Legitimate exceptions are narrow and documented: an untyped third-party library, or a wrong
upstream type, with `@ts-expect-error` and a comment saying why. Never a silent `any`.

## No god files

There is no line-count gate: line count is a proxy, and the real signal is responsibility
count. A file that mixes routing, data access, business logic and rendering is a god file at
80 lines as much as at 800. Split by concern and name the file for what it does. As a prompt
during review, ESLint's own `max-lines` / `max-lines-per-function` defaults are 300 / 50:
crossing them means asking "does this still have one job", not failing automatically.

Mobile screens under `apps/mobile/app/` are the usual offender: a screen that fetches, maps,
validates and renders. Data goes in a hook (`apps/mobile/hooks/`), shared logic in
`apps/mobile/lib/`, and the screen renders.

## DRY, without premature abstraction: the Rule of Three

Write it once. The second time, duplicate it. The third time, extract it. Two occurrences are
not enough to know the real shared shape; extracting too early produces an abstraction that
accumulates flags and special cases as mismatched callers are forced into it. If a helper
starts growing branches for callers that don't share behaviour, inline it back and re-extract
once the shape is clear. Duplication is cheaper than the wrong abstraction.

The exception is a definition two surfaces must agree on: that is extracted the first time.
"Paid user" lives in `apps/web/src/lib/dashboard-stats.ts` and nowhere else; the brand colours
live in `packages/brand`; the `v1` API contract lives in one schema both apps import
([mobile data](mobile-data.md)).

## No magic numbers

Deliberately not an ESLint rule: `no-magic-numbers` is noisy enough (`data[0]`, `width / 2`)
that it gets switched off. Enforced by review instead: a threshold, rate, timeout or limit gets
a named constant. `data[0]` and loop counters don't.

## Logging and errors

- **No `console.*` in application code.** `no-console` is an error in `apps/web/src/` and in
  `apps/mobile/{app,components,contexts,hooks,lib}/`. Scripts and config files are exempt.
  See [logging](logging.md).
- **Errors are reported, not printed.** Unexpected errors go through the logger's `log.error`
  (to Sentry on mobile, to Vercel's logs on the web, which has no Sentry), never a bare
  `console.error` or a direct `Sentry.captureException` ([error handling](error-handling.md)).
- **User-facing messages are friendly, never implementation.** No stack trace, raw database
  error or internal code in a response body, a toast or an alert. Verbose errors are free
  reconnaissance for an attacker, not only bad UX.

## Comments that earn their keep

Default to none. Write one when it says something the code can't: why a decision was made, a
non-obvious invariant, a side effect, a workaround for a specific bug. A comment that restates
a well-named function is noise, and worse for an agent than for a person, because it dilutes
the signal. The strongest documentation is a machine-checked contract: a Zod schema, a precise
type, a single-purpose function.

## Naming

- **camelCase**: variables, functions, object properties.
- **PascalCase**: React components, types and interfaces, classes.
- **SCREAMING_SNAKE_CASE**: true module-level constants (`MAX_RETRIES`, `ENTITLEMENT_ID`).
- **snake_case**: Postgres table and column names, analytics event names and their properties
  ([analytics](analytics.md)). In `apps/web`, TypeScript names are camelCase and bridge to
  the columns with `@map` / `@@map` in the Prisma schema. A row that leaves in a contract
  keeps the snake_case names the contract has always used (the Play Stats API, the admin
  list, `@app/contract`), converted once: in the store on the web, and in the data hooks'
  mappers on the device (`apps/mobile/hooks/`), never half-converted.

## Easy to maintain, not maximally clever

The next person or agent touching the code should not have to hold more in their head than
the change needs. When one of these rules and "ship the simple thing" pull in different
directions, [feature approach](feature-approach.md) settles it.
