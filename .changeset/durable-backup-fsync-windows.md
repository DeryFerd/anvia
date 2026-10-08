---
"@anvia/durable": patch
---

Fix `backupSqlite`/`restoreSqlite` on Windows: `fsync` was called on a read-only handle, which Windows rejects with `EPERM`. The handle now opens with write access on Windows (POSIX keeps the read-only handle so directory syncs still work). Also make the crash-signal assertion in the backup hardening test platform-aware, since Windows force-terminates the process instead of delivering `SIGKILL`.
