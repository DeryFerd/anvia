---
"@anvia/core": patch
---

Omit stack traces from `toReadableStream` error events. Error JSON lines emitted
when the wrapped async iterable throws now carry only the error name and message,
matching the safe serializers already used by `@anvia/server` and Studio run
failure responses.
