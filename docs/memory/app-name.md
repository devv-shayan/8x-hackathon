---
name: app-name
description: The app is called Chalkback; which identifiers changed and what the rename left to do
metadata:
  type: project
---

The app was named Chalkback on 2026-10-31, replacing the working name Protégé and the template's
MyApp. The name says you're at the chalkboard and the class talks back. Domains, trademarks and
store names had not been checked when it was picked.

`app.json` now uses slug `chalkback`, scheme `chalkback` and bundle id `com.chalkback.app`. No store
build existed, so nothing shipped carries the old ids. The bundle id can't change after the first
store release, so confirm it first. The `@app/` npm scope stays: it is internal and never shown.

**Why:** the name is what people see at Feedback 2, and the template still said MyApp.

**How to apply:** Apple or Google sign-in needs `chalkback://auth/callback` in hosted Supabase's
redirect list. The icon, splash and marketing site are still the template's.
