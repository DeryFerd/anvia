---
"@anvia/mcp": minor
---

Bound Streamable HTTP responses per JSON-RPC message in `McpClient`. The new
`transport.maxBufferSize` option caps the JSON body of a regular response and each SSE event of an
event stream (default 10 MiB, matching the stdio transport's buffer default), so an untrusted MCP
server can no longer stream unbounded data into the agent process. The bound applies to both SSRF
protection modes; `custom` transports remain caller-owned.
