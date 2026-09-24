---
"@anvia/studio": minor
---

Add `close()` to the SQLite session store. `createSqliteSessionStore(...)` now returns a store
with an explicit `close()` method (typed as `SqliteSessionStoreHandle`), which releases the
underlying SQLite handle and reopens lazily on the next call. This gives callers a way to
release the database the way the README's graceful-shutdown guidance already expects for other
caller-owned resources.

Schema setup that fails after the database has been opened (for example the legacy
`messages_json` guard) now closes the handle before rethrowing, so the documented "delete or
recreate the database" recovery works instead of leaving the file locked.
