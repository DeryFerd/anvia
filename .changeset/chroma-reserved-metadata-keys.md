---
"@anvia/chroma": patch
---

Reject reserved metadata keys during document upsert. Chroma stores the logical document id in
`__anvia_document_id`, and query results only strip that one key before returning metadata. Unlike
the other vector adapters, the store accepted metadata keys beginning with `__anvia_` from
application input, so a supplied `__anvia_document` (or any other `__anvia_`-prefixed key) was
written alongside the internal key and read back out to callers. Upsert now validates each
document's metadata before the collection delete runs, matching the guards already enforced by the
Qdrant, LanceDB, Weaviate, Redis, Pinecone, pgvector, and Milvus adapters.
