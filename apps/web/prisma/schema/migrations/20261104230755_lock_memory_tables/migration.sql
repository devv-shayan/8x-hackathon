ALTER TABLE "memory_marks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "memory_marks" FROM anon, authenticated;
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "push_tokens" FROM anon, authenticated;
