---
"@anvia/sandbox": patch
---

Refuse sandbox file writes whose container destination is an existing symlink so
`docker cp` cannot redirect a write outside the workspace, mirroring the read-path
guard.
