-- The security statement for the run-once ledger created just before this migration, the
-- one every new table gets (docs/rules/migrations.md). The ledger is written only by
-- scripts/run-once-sql.mjs as the table owner, which RLS never gates, so this costs nothing
-- and keeps the rule at "every table" with no exemption. No policies, never FORCE, and
-- nothing for the API roles that Supabase's default privileges granted it.
ALTER TABLE "_run_once_sql" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "_run_once_sql" FROM anon, authenticated;
