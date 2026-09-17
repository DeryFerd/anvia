---
"@anvia/browser": patch
---

Block private and reserved IP literals in `browser_navigate` under every navigation policy, including `origins` policies that list them, and on each redirect the automation worker follows. The guard uses the IANA special-purpose address ranges, so public hosts and globally reachable addresses (for example `192.0.0.9` and `192.0.0.10`) are unaffected.
