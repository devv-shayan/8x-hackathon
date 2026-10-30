ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "topics" FROM anon, authenticated;
