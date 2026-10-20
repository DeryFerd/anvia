---
"@anvia/sandbox": patch
---

Reject sandbox file writes when the destination or any parent path component is a symlink,
including dangling links. Inspect before creating parent directories and again before copying
bytes, preventing existing links from redirecting either operation outside the workspace.
