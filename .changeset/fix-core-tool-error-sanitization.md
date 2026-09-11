---
"@anvia/core": patch
---

Sanitize tool error messages returned to the LLM. Previously, `handleToolError` used `error.toString()` which on custom Error subclasses can include stack traces, file paths, and credentials. The function now extracts only the error name and message, preventing information leakage through LLM context.
