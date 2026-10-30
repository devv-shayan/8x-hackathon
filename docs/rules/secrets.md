# Secrets

This template is cloned by many engineers, and every clone carries whatever this repo carries.
A credential that lands here once is in every play's history. So a secret lives in exactly one
kind of place, and it is never a file in git.

## Where a secret lives

| Secret for                       | Lives in                                                                                                      | Never in                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web` (server)              | The hosting provider's environment variables (Vercel, per environment); `apps/web/.env.local` on your machine | Source, `.env.example`, a `NEXT_PUBLIC_*` name, a log line, a comment |
| `apps/mobile` builds and updates | **EAS environment variables** (`eas env:set`, per environment); `apps/mobile/.env.local` on your machine      | `eas.json`, `app.json`, source, an `EXPO_PUBLIC_*` name               |
| CI                               | GitHub Actions secrets                                                                                        | The workflow file                                                     |
| Your agent's MCP servers         | Your shell environment; `.mcp.json` only references them as `${VAR}`                                          | `.mcp.json`, chat                                                     |
| A database migration in CI       | The `production-database` GitHub environment (`PRODUCTION_DATABASE_URL`)                                      | The workflow file, a migration, `run-once.sql`                        |

`.gitignore` ignores the real env files, so they can't land in git: `.env`, `.env.local`,
`.env.*.local`, and the per-environment names `.env.development`, `.env.dev`, `.env.test`,
`.env.staging`, `.env.preview`, `.env.production` and `.env.prod`. That is the same list
`.claude/settings.json` denies, and it is a list, not a `.env*` wildcard: a new real-env
filename a play invents goes into both. The example files (`apps/web/.env.example`,
`apps/mobile/.env.example`) name each variable and hold no value. `docs/ENV_SETUP.md` says what
each variable is and where to get it.

On the web, `apps/web/src/lib/env.ts` declares every variable in one Zod schema, validated once
at boot, and `npm run check:env` fails when the code, the schema and `.env.example` disagree; on
mobile, `apps/mobile/lib/env.ts` does the same for `EXPO_PUBLIC_*`, and ESLint rejects
`process.env` anywhere else in the app.

## Mobile: what is public, and what never goes in a config file

- **`EXPO_PUBLIC_*` is public by definition.** Expo inlines it into the JavaScript bundle, and
  anyone who downloads the app can read it. Only values that are safe in public go there: the
  Supabase URL and publishable key, RevenueCat's public SDK keys, the Sentry DSN, the PostHog
  project key, the site URL. **Nothing secret is ever named `EXPO_PUBLIC_*`**, and no
  `EXPO_PUBLIC_*` name contains `SECRET`, `SERVICE_ROLE`, `PRIVATE` or `WEBHOOK`. If the app
  needs something only a server may hold, the app calls `apps/web` and the server uses it.
- **`eas.json` and `app.json` carry no values.** They are committed and cloned. `app.json`
  holds `REPLACE_WITH_…` placeholders for per-play identity; `eas.json` build profiles name
  their EAS `environment` and carry no `env`. EAS does not expand `$VAR` in `eas.json`:
  `"SENTRY_AUTH_TOKEN": "$SENTRY_AUTH_TOKEN"` is that literal string, and it overrides a
  `plaintext` or `sensitive` variable of the same name.
- **Values go in EAS environment variables**, one set per environment (`development`,
  `preview`, `production`). Use visibility `secret` for anything that is only needed on EAS's
  servers, by a build or by the update workflow (`SENTRY_AUTH_TOKEN`), and `sensitive` or
  `plaintext` for the `EXPO_PUBLIC_*` values the bundle needs. A `secret` value is never
  readable on your machine, so `eas update` run there doesn't get it: never put a value the app
  itself needs there; nothing embedded in the app is protected by being "secret" anyway.
- **One name, one place.** A build profile's `env` in `eas.json` takes precedence over an EAS
  environment variable of the same name. Once a value lives in EAS, delete that name from the
  profile's `env`; a leftover `REPLACE_WITH_…` placeholder there wins and ships.
- `eas update` on this SDK requires `--environment` and reads only EAS environment variables,
  so a value that exists only in `eas.json` reaches a build but never an update
  ([OTA updates](ota.md)).
- Store credentials (App Store Connect API keys, the Play service-account JSON, signing keys
  and keystores) live with EAS credentials or in the vault outside every repo. Never a
  `*.p8`, `*.jks`, `*.keystore` or service-account JSON in the tree.

## Web: server-only means server-only

- `SUPABASE_SECRET_KEY` (legacy name `SUPABASE_SERVICE_ROLE_KEY`), `DASHBOARD_API_KEY`,
  `PLAY_INGEST_KEY`, `REVENUECAT_WEBHOOK_SECRET` and `CRON_SECRET` are read only in server code
  (API routes and server-only modules). None is ever prefixed `NEXT_PUBLIC_`.
- Use Supabase's publishable and secret keys; the legacy anon and service-role JWTs are
  fallbacks for older deployments only.
- Generate shared secrets, don't invent them: `openssl rand -hex 32`.

## Never in chat, never in a transcript

- **Never paste a key, token or password into a conversation with an agent**, and never ask an
  engineer to. An agent that needs a value to be set asks the person to set it in the right
  place above, themselves: in their own terminal or the provider's dashboard, not by having the
  agent run a command with the value in it (`eas env:set --value …`), which writes it into the
  agent's transcript.
- **No agent reads a real env file, by any means.** `.claude/settings.json` denies them (`.env`,
  `.env.local`, `.env.*.local` and the per-environment names above) to Claude Code's
  file-reading tools, but that deny list does not reach the shell: `cat`, `grep`, `head` or
  `source` on the same file would put every value in the transcript. Don't run them, and don't
  run a script whose output prints one. Other tools honour the same rule by convention.
  `.env.example` stays readable: it is committed, holds placeholders only, and `check:env`
  needs agents to keep it in step with the schema. A new real-env filename a play invents is
  added to that deny list and to `.gitignore`.
- In a play, session transcripts are committed verbatim (`.claude-logs/`, `.codex-logs/`; the
  template repository itself keeps none). A value that scrolled past in a session rides along
  into history. If one did, redact it in the transcript
  before it is committed; a transcript never needs the real value.
- **Docs and examples use obvious placeholders**: `<your-publishable-key>`, `REPLACE_WITH_…`,
  `postgresql://user:password@host:5432/db`. Never a real-looking key, token, JWT, project ref
  or password, even as an example, even an expired one.
- A secret that was committed is compromised: remove it, **rotate it**, then tell whoever owns
  it. Git history keeps what was pushed.

## The scanner is a backstop, not a licence

`scripts/check-secrets.mjs` looks for credential shapes (connection strings with a password,
provider key formats, Supabase `sb_secret_…` keys, JWTs, `Authorization` values, PEM private
keys, a high-entropy value under a credential-named key, including quoted keys in
`eas.json`/`app.json`) and refuses the commit. One implementation, two enforcement points:

- **`.githooks/pre-commit`** scans the staged files of every commit.
- **CI** re-scans every tracked file (`npm run check:secrets`), so a `--no-verify` commit, or
  one made before the hook was installed, still fails the branch.

It deliberately allows public-by-design values (Supabase `sb_publishable_…`,
RevenueCat's `appl_`/`goog_`/`amzn_` SDK keys) and the placeholder shapes above.

It is a backstop, like the logger's redaction ([logging](logging.md)), not permission to be
careless. When it fires on something that genuinely is not a secret:

1. `allowlist secret` in a comment on the line, for a deliberate fake value in a test.
2. A glob in `.secretsallow`, only for a file that is all fixtures.

For a real credential the fix is removing and rotating it, never allowlisting it.
