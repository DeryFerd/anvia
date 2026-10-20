import { describe, expect, it } from "vitest";
import { tools } from "../src/index";

describe("Grok provider tools", () => {
  it("creates typed web and X search configurations", () => {
    expect(
      tools.webSearch({
        allowedDomains: ["x.ai"],
        enableImageUnderstanding: true,
        enableImageSearch: true,
      }),
    ).toEqual({
      kind: "provider",
      provider: "grok",
      name: "web_search",
      configuration: {
        filters: { allowed_domains: ["x.ai"] },
        enable_image_understanding: true,
        enable_image_search: true,
      },
    });
    expect(
      tools.xSearch({
        allowedHandles: ["xai"],
        fromDate: "2026-01-01",
        toDate: "2026-07-29",
        enableVideoUnderstanding: true,
      }),
    ).toMatchObject({
      name: "x_search",
      configuration: {
        allowed_x_handles: ["xai"],
        from_date: "2026-01-01",
        to_date: "2026-07-29",
        enable_video_understanding: true,
      },
    });
  });

  it("creates code, file search, and remote MCP tools", () => {
    expect(tools.codeInterpreter()).toEqual({
      kind: "provider",
      provider: "grok",
      name: "code_interpreter",
    });
    expect(tools.fileSearch({ vectorStoreIds: ["collection_1"], maxNumResults: 10 })).toMatchObject(
      {
        name: "file_search",
        configuration: { vector_store_ids: ["collection_1"], max_num_results: 10 },
      },
    );
    expect(
      tools.mcp({
        serverUrl: "https://mcp.example.com/tools",
        serverLabel: "example",
        allowedTools: ["lookup"],
        authorization: "token",
        headers: { "X-Tenant": "tenant" },
      }),
    ).toMatchObject({
      name: "mcp",
      configuration: {
        server_url: "https://mcp.example.com/tools",
        server_label: "example",
        allowed_tools: ["lookup"],
        authorization: "token",
        headers: { "X-Tenant": "tenant" },
      },
    });
  });

  it("validates documented search boundaries", () => {
    expect(() =>
      tools.webSearch({ allowedDomains: ["x.ai"], excludedDomains: ["example.com"] }),
    ).toThrow("cannot be used together");
    expect(() => tools.webSearch({ allowedDomains: ["1", "2", "3", "4", "5", "6"] })).toThrow(
      "at most 5",
    );
    expect(() =>
      tools.xSearch({
        fromDate: "2026-07-29",
        toDate: "2026-01-01",
      }),
    ).toThrow("must not be after");
    expect(() =>
      tools.mcp({ serverUrl: "http://mcp.example.com", serverLabel: "example" }),
    ).toThrow("must use HTTPS");
  });

  it("rejects MCP server URLs that target private or reserved hosts", () => {
    const blocked = [
      "https://127.0.0.1:8443/tools",
      "https://10.0.0.15/tools",
      "https://172.16.4.9/tools",
      "https://192.168.1.10/tools",
      "https://169.254.169.254/latest/meta-data",
      "https://127.1/tools",
      "https://localhost/tools",
      "https://internal.localhost/tools",
      "https://[::1]/tools",
      "https://[fd00::1]/tools",
    ];
    for (const serverUrl of blocked) {
      expect(() => tools.mcp({ serverUrl, serverLabel: "example" })).toThrow(
        "must not target a private or reserved host",
      );
    }

    expect(() =>
      tools.mcp({ serverUrl: "https://mcp.example.com/tools", serverLabel: "example" }),
    ).not.toThrow();
  });
});
