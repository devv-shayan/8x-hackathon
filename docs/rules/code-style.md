# Code style

- **Formatting is Prettier's** (`.prettierrc.json`: tabs, no semicolons, single quotes, no
  trailing commas, width 100, Tailwind classes sorted against each app's own Tailwind config).
  `npm run format` writes it; `npm run format:check` is the gate. Never hand-format against it,
  and never mix a formatting change with a behaviour change in one commit.
- **Zod at every boundary.** Every API route parses its input with a Zod schema at runtime;
  every response the app receives is parsed with the same schema the server used
  (`@app/contract`, in `apps/mobile/lib/api.ts`); environment variables are parsed once at boot
  (`apps/web/src/lib/env.ts`, `apps/mobile/lib/env.ts`). No hand-written wire types: derive
  them with `z.infer`. Where a boundary has no schema yet, validate by hand rather than trusting
  the shape.
- **Functions taking more than one argument take a single object.** Booleans are prefixed
  `is` / `has` / `should` / `can`. Null checks use `== null` / `!= null`.
- **No `@ts-ignore`.** Fix the type or narrow it. `@ts-expect-error` only with a comment saying
  why ([code quality](code-quality.md)).
- **Dates crossing an API boundary are ISO 8601 strings, in UTC.** Only display formatting
  localises. Money is integer minor units plus an ISO 4217 currency, never a float
  (`docs/EVENTS.md`).
- **Styling goes through the brand tokens.** Colours, fonts, radii, shadows and motion are
  defined once in `packages/brand` (`@app/brand`; rebrand in `brand.config.ts`): the web reads
  them as CSS variables through its Tailwind preset, the app through its ThemeProvider. Never
  hardcode a colour. Web merges conditional classes with `cn()` (`apps/web/src/lib/utils.ts`);
  the app styles with `makeStyles((c) => …)` / `useColors()` (`lib/themedStyles.ts`,
  `contexts/ThemeContext.tsx`), so every style follows the preset and the light/dark choice.
- **New user-facing copy on mobile goes in the translation files** (`apps/mobile/locales/`,
  through i18next). Much of the template's own copy is still inline; move a string when you
  touch it rather than adding another.
- **No comments that restate the code.** A comment says why, or states a non-obvious
  constraint ([code quality](code-quality.md)).
