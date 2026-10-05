---
"@anvia/logger": minor
"@anvia/core": patch
---

Omit `error.stack` from serialized observer errors by default so host filesystem paths stay out of
shared logs, and add `includeErrorStack` to `LoggerObserverOptions` to opt stacks (including nested
`Error.cause` chains) back in for local debugging. Extend core's default redaction patterns with
well-known Google API key, GitHub token, AWS access key id, and Slack token credential shapes.
