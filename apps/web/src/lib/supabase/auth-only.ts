import type { SupabaseClient } from '@supabase/supabase-js'

// The auth surface of a Supabase client, plus storage for signed upload URLs, and nothing
// else. Every wrapper in this directory returns it, so `supabase.from()` and `.rpc()` are
// type errors rather than a rule to remember — Prisma owns every byte of application data
// (docs/rules/database.md, docs/rules/auth.md). From template-web, with 'storage' added for
// POST /api/app/v1/uploads (docs/rules/mobile-data.md): the server authorizes the person,
// then hands out a signed upload URL. Storage is files, never table rows. A project
// that adopts Supabase realtime widens this to add 'channel' | 'removeChannel'
// deliberately, in this one place; never to 'from' or 'rpc'.
export type AuthOnlySupabaseClient = Pick<SupabaseClient, 'auth' | 'storage'>
