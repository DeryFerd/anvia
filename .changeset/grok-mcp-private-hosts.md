---
"@anvia/grok": patch
---

Reject Grok MCP `serverUrl` values that target private, loopback, link-local,
or otherwise reserved hosts instead of accepting any HTTPS URL.
