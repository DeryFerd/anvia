---
"@anvia/azure": patch
---

Require HTTPS for non-loopback Azure OpenAI endpoints. `endpoint` and `baseUrl` now reject plain
`http://` URLs unless the host is a loopback development target (`localhost`, `127.0.0.1`, or
`[::1]`), so API keys are never sent over cleartext to remote hosts. Existing `https://`
configurations and local emulator setups such as `http://127.0.0.1:10000` keep working unchanged.
