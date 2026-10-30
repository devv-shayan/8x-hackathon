# Logging

> **Status.** Both loggers exist: the web server's (Pino, in `apps/web/src/server/lib/logger/`,
> with its three contract tests) and the app's (`apps/mobile/lib/logger/`). `no-console` is a
> lint error in all application code, with two exceptions `eslint.config.mjs` names: the mobile
> logger itself, whose development sink is the console, and `console.warn`/`console.error` in
> `apps/web/src/lib/env.ts` and `instrumentation*.ts`, which report invalid boot config before
> the server-only logger can load. `env.ts`'s `console.error` is the one such call today.

Two jobs. Don't blend them:

- **Logging** is the _record of what happened_: a cron run started, an external call took
  900 ms, a batch settled 42 of 50 items, the app fell back to cached data.
- **Error reporting** is for _what broke_: an unexpected exception someone should look at
  ([error handling](error-handling.md)). Report it with `log.error`, whichever app it is in:
  - **Web:** there is no Sentry. The Pino logger is not an error reporter: `log.error` writes an
    error-level line to Vercel's logs, and that line is the report.
  - **Mobile:** in a release build `log.error` is the one call that reports to Sentry
    ([below](#mobile-the-apps-logger-on-the-device)); `info` and `warn` are breadcrumbs that
    ride along with the next report, and `debug` is dropped. Sentry is not a log of routine
    activity.

An expected, handled failure (a declined payment, a taken username) is neither. It is normal
control flow: count it in PostHog, don't Sentry it and don't log-spam it.

## Web: Pino on the server

Application code imports the shared wrapper, never `pino` directly; ESLint permits that import
only inside the logger module.

```ts
import { log } from '@/server/lib/logger'

log.info('sync started', { source: 'revenuecat', batchSize: 50 })
log.warn('rate limited, backing off', { retryInMs: 2000 })
log.error('lifecycle cron finished with skips', { skipped: 8 }) // handled, not a page
```

- `log.debug | info | warn | error(message, fields?)`: `message` is a short human string;
  everything structured goes in `fields`.
- `log.child(fields)` stamps fields on every line; bind `{ source }` once at the top of a job.
- `withLogContext({ runId }, fn)` carries fields through everything `fn` calls, without
  passing them down.
- An `Error` in `fields` is serialised in full (name, message, stack, `cause` chain).
- Structured JSON, one object per line, to stdout. Vercel's log drain is the transport.
- `LOG_LEVEL` sets the floor (`debug | info | warn | error | silent`); `info` by default,
  `silent` under `NODE_ENV=test`.
- **Server-only.** It uses `node:async_hooks` and `process.stdout`; ESLint blocks a
  `'use client'` file from importing it.

`npm test` runs the logger, redaction and context contract tests; the `structured-logger`
standard checks they are wired, in the `apps/web` workspace.

## Mobile: the app's logger, on the device

There is no Node server on a phone, so there is no Pino, no stdout and no log drain there.
`apps/mobile` must never depend on `pino` (the checker fails an Expo workspace that does).

The mobile logger (`import { log } from '@/lib/logger'`) has the same message-first API
(`log.info(message, fields)`, `log.child(fields)`), and:

- in development, writes to the console, so Metro shows it;
- in a release build, records **Sentry breadcrumbs**, so the lines leading up to a crash
  arrive with the crash report instead of vanishing on the device;
- in a release build, also sends `log.error` to Sentry as an event: an exception when an
  `Error` is passed as `{ error }`, a message otherwise. A phone has no log drain, so this is
  the one reporting place [error handling](error-handling.md) names. Use `error` only for
  what broke; a handled failure is `warn`;
- runs every line through the same redaction list as the web logger before it goes anywhere
  (`lib/logger/redact.ts` is template-web's `redact.ts`, copied verbatim).

ESLint bans `console.*` in `apps/mobile/{app,components,contexts,hooks,lib}/`. The logger module
itself is the one place allowed to call the console.

## Redaction is a backstop, not a licence

Every line is run through `redact()`, which strips values under sensitive key names
(`*token*`, `*secret*`, `*password*`, `authorization`, `cookie`, …) and scrubs credentials out
of strings (connection-string passwords, `?api_key=` parameters, `Bearer` headers, email
addresses). It exists so a field someone _forgot_ was sensitive (a whole request object, an
error message quoting a connection string) doesn't leak. It is not permission to log a secret
or personal data on purpose. Don't put tokens, email addresses or user-typed text in `fields`
and rely on the scrubber.

On mobile this matters twice: a breadcrumb leaves the device with the crash report.

## What never goes in a log line

- Credentials of any kind ([secrets](secrets.md)).
- Personal data: email addresses, names, what a user typed. Log the user's id, not who they are.
- Whole request or response bodies. Log the fields you need.
