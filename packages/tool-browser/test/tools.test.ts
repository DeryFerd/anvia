import { describe, expect, it, vi } from "vitest";
import { type AutomationBackend, PlaywrightBrowserConnectionImpl } from "../src/connection";
import { BrowserControlState } from "../src/control";
import { createBrowserTools } from "../src/tools";

describe("createBrowserTools", () => {
  it("requires an explicit, unique tool selection and navigation policy", () => {
    const connection = fakeConnection().connection;
    expect(() => createBrowserTools({ connection, tools: [] } as never)).toThrow("non-empty");
    expect(() =>
      createBrowserTools({
        connection,
        tools: ["browser_snapshot", "browser_snapshot"],
        navigation: { mode: "allow-all-http" },
      }),
    ).toThrow("duplicate");
    expect(() =>
      createBrowserTools({
        connection,
        tools: ["browser_snapshot"],
        navigation: { mode: "origins", origins: [] },
      }),
    ).toThrow("non-empty origin");
  });

  it("blocks non-HTTP navigation before Playwright receives it", async () => {
    const { connection, command } = fakeConnection();
    const [navigate] = createBrowserTools({
      connection,
      tools: ["browser_navigate"],
      navigation: { mode: "allow-all-http" },
    });
    await expect(navigate?.call({ url: "file:///etc/passwd" })).rejects.toMatchObject({
      code: "navigation_blocked",
    });
    expect(command).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "navigate" }),
      expect.anything(),
    );
  });

  describe("SSRF protection", () => {
    it("blocks localhost URLs even with allow-all-http policy", async () => {
      const { connection, command } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Block localhost names, including fully qualified spellings with a trailing root dot.
      for (const url of [
        "http://localhost:8080",
        "http://localhost.:8080",
        "http://service.localhost.:8080",
      ]) {
        await expect(navigate?.call({ url })).rejects.toMatchObject({
          code: "navigation_blocked",
        });
      }

      // Block 127.0.0.1
      await expect(navigate?.call({ url: "http://127.0.0.1:3000" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block 127.x.x.x range
      await expect(navigate?.call({ url: "http://127.0.0.2" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      expect(command).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "navigate" }),
        expect.anything(),
      );
    });

    it("blocks private IP ranges even with allow-all-http policy", async () => {
      const { connection, command } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Block 10.0.0.0/8
      await expect(navigate?.call({ url: "http://10.0.0.1" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://10.255.255.255" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block 172.16.0.0/12
      await expect(navigate?.call({ url: "http://172.16.0.1" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://172.31.255.255" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block 192.168.0.0/16
      await expect(navigate?.call({ url: "http://192.168.1.1" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://192.168.255.255" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      expect(command).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "navigate" }),
        expect.anything(),
      );
    });

    it("blocks link-local and reserved IP ranges", async () => {
      const { connection, command } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Block 169.254.0.0/16 (link-local, AWS metadata)
      await expect(navigate?.call({ url: "http://169.254.169.254" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block 0.0.0.0/8
      await expect(navigate?.call({ url: "http://0.0.0.0" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      expect(command).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "navigate" }),
        expect.anything(),
      );
    });

    it("blocks IPv6 loopback, link-local, and unique-local addresses", async () => {
      const { connection, command } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Block ::1 (loopback)
      await expect(navigate?.call({ url: "http://[::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block fe80::/10 link-local range
      await expect(navigate?.call({ url: "http://[fe80::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://[fe90::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://[febf::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block fc00::/7 unique-local range
      await expect(navigate?.call({ url: "http://[fc00::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://[fd00::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // Block multicast ff00::/8
      await expect(navigate?.call({ url: "http://[ff02::1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      expect(command).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "navigate" }),
        expect.anything(),
      );
    });

    it("blocks IPv4-mapped IPv6 addresses of blocked ranges", async () => {
      const { connection, command } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // ::ffff:127.0.0.1 = loopback
      await expect(navigate?.call({ url: "http://[::ffff:127.0.0.1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // ::ffff:10.0.0.1 = private
      await expect(navigate?.call({ url: "http://[::ffff:10.0.0.1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // ::ffff:192.168.1.1 = private
      await expect(navigate?.call({ url: "http://[::ffff:192.168.1.1]" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // ::ffff:169.254.169.254 = link-local (AWS metadata)
      await expect(
        navigate?.call({ url: "http://[::ffff:169.254.169.254]" }),
      ).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      expect(command).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "navigate" }),
        expect.anything(),
      );
    });

    it("blocks IETF protocol assignments except globally reachable anycast addresses", async () => {
      const { connection } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // 192.0.0.0/24 is not globally reachable, including the dummy address at .8
      // and the NAT64 discovery addresses at .170 and .171
      for (const url of ["http://192.0.0.1", "http://192.0.0.8", "http://192.0.0.11"]) {
        await expect(navigate?.call({ url })).rejects.toMatchObject({ code: "navigation_blocked" });
      }
      await expect(navigate?.call({ url: "http://192.0.0.170" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });
      await expect(navigate?.call({ url: "http://192.0.0.255" })).rejects.toMatchObject({
        code: "navigation_blocked",
      });

      // IANA marks 192.0.0.9 (PCP anycast) and 192.0.0.10 (TURN anycast) globally reachable
      for (const url of ["http://192.0.0.9", "http://192.0.0.10"]) {
        await expect(navigate?.call({ url })).resolves.toMatchObject({ url });
      }
    });

    it("blocks special-purpose IPv6 ranges and embedded IPv4 forms", async () => {
      const { connection } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      for (const url of [
        "http://[64:ff9b:1::1]", // NAT64 local-use prefix
        "http://[100::1]", // discard-only
        "http://[100:0:0:1::1]", // dummy IPv6 prefix
        "http://[2001::1]", // Teredo
        "http://[2001:2::1]", // benchmarking
        "http://[2001:10::1]", // ORCHID
        "http://[2001:db8::1]", // documentation
        "http://[2002::1]", // 6to4
        "http://[3fff::1]", // documentation
        "http://[5f00::1]", // segment routing SIDs
        "http://[fec0::1]", // deprecated site-local
        "http://[::7f00:1]", // deprecated IPv4-compatible spelling of 127.0.0.1
        "http://[::ffff:7f00:1]", // IPv4-mapped hex spelling of 127.0.0.1
      ]) {
        await expect(navigate?.call({ url })).rejects.toMatchObject({ code: "navigation_blocked" });
      }
    });

    it("keeps addresses adjacent to blocked ranges reachable", async () => {
      const { connection } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Upper and lower bounds of 100.64.0.0/10, 192.0.2.0/24, 198.18.0.0/15,
      // and 203.0.113.0/24
      for (const url of [
        "http://100.64.0.0",
        "http://100.127.255.255",
        "http://192.0.2.0",
        "http://192.0.2.255",
        "http://198.18.0.0",
        "http://198.19.255.255",
        "http://203.0.113.0",
        "http://203.0.113.255",
      ]) {
        await expect(navigate?.call({ url })).rejects.toMatchObject({ code: "navigation_blocked" });
      }

      // The neighboring addresses just outside those ranges
      for (const url of [
        "http://100.63.255.255",
        "http://100.128.0.0",
        "http://192.0.1.255",
        "http://192.0.3.0",
        "http://198.17.255.255",
        "http://198.20.0.0",
        "http://203.0.112.255",
        "http://203.0.114.0",
        "http://[2001:db7::1]",
        "http://[2001:db9::1]",
        "http://[2003::1]",
      ]) {
        await expect(navigate?.call({ url })).resolves.toMatchObject({ url });
      }
    });

    it("allows globally reachable IPv6 addresses", async () => {
      const { connection } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      for (const url of [
        "http://[64:ff9b::7f00:1]", // NAT64 well-known prefix
        "http://[2001:20::1]", // ORCHIDv2
        "http://[2606:4700:4700::1111]",
        "http://[2001:4860:4860::8888]",
      ]) {
        await expect(navigate?.call({ url })).resolves.toMatchObject({ url });
      }
    });

    it("blocks response URL pointing to private IP after successful navigation", async () => {
      const { connection, command } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Override the navigate handler to return a private-IP response URL
      command.mockImplementation(
        async (request: { method: string; params?: Record<string, unknown> }) => {
          if (request.method === "navigate") {
            return {
              tabId: "11111111-1111-4111-8111-111111111111",
              title: "Redirected",
              url: "http://127.0.0.1/admin",
            };
          }
          // Default: return standard listTabs response
          return [
            {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Example",
              url: "https://example.com",
              selected: true,
            },
          ];
        },
      );

      // The tool-level assertNavigationAllowed(result.url) should block this
      await expect(
        navigate?.call({
          tabId: "11111111-1111-4111-8111-111111111111",
          url: "http://example.com",
        }),
      ).rejects.toMatchObject({
        code: "navigation_blocked",
      });
    });

    it("allows public IP addresses with allow-all-http policy", async () => {
      const { connection } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Allow public IPs (these should NOT be blocked)
      const result1 = await navigate?.call({ url: "http://8.8.8.8" });
      expect(result1).toMatchObject({ url: "http://8.8.8.8" });

      const result2 = await navigate?.call({ url: "http://1.1.1.1" });
      expect(result2).toMatchObject({ url: "http://1.1.1.1" });
    });

    it("allows public domains with allow-all-http policy", async () => {
      const { connection } = fakeConnection();
      const [navigate] = createBrowserTools({
        connection,
        tools: ["browser_navigate"],
        navigation: { mode: "allow-all-http" },
      });

      // Allow public domains (these should NOT be blocked)
      const result1 = await navigate?.call({ url: "http://example.com" });
      expect(result1).toMatchObject({ url: "http://example.com" });

      const result2 = await navigate?.call({ url: "https://github.com" });
      expect(result2).toMatchObject({ url: "https://github.com" });
    });
  });

  it("reports navigation policy rejection from redirects as navigation_blocked", async () => {
    const { connection, command } = fakeConnection();
    const [navigate] = createBrowserTools({
      connection,
      tools: ["browser_navigate"],
      navigation: { mode: "origins", origins: ["https://example.com"] },
    });
    await connection.listTabs();
    command.mockRejectedValueOnce(new Error("page.goto: net::ERR_BLOCKED_BY_CLIENT"));

    await expect(
      navigate?.call({
        tabId: "11111111-1111-4111-8111-111111111111",
        url: "https://example.com/redirect",
      }),
    ).rejects.toMatchObject({ code: "navigation_blocked" });
  });

  it("installs the navigation policy before browser interaction", async () => {
    const { connection, command } = fakeConnection();
    const [snapshot] = createBrowserTools({
      connection,
      tools: ["browser_snapshot"],
      navigation: { mode: "origins", origins: ["https://example.com"] },
    });
    await snapshot?.call({});

    expect(command.mock.calls[0]?.[0]).toEqual({
      method: "setNavigationPolicy",
      params: { policy: { mode: "origins", origins: ["https://example.com"] } },
    });
    expect(command.mock.calls[0]?.[1]).toEqual(expect.anything());
  });

  it("returns native structured PNG output", async () => {
    const { connection } = fakeConnection();
    const [screenshot] = createBrowserTools({
      connection,
      tools: ["browser_screenshot"],
      navigation: { mode: "allow-all-http" },
    });
    const output = await screenshot?.call({});
    expect(output).toMatchObject({
      content: [
        { type: "text" },
        { type: "file", mediaType: "image/png", filename: "browser-screenshot.png" },
      ],
    });
  });

  it("rejects agent tools while Studio holds human control", async () => {
    const control = new BrowserControlState();
    const { connection } = fakeConnection(control);
    const [snapshot] = createBrowserTools({
      connection,
      tools: ["browser_snapshot"],
      navigation: { mode: "allow-all-http" },
    });
    const lease = await control.acquireHumanControl({ ownerId: "viewer", leaseTimeoutMs: 30_000 });
    await expect(snapshot?.call({})).rejects.toMatchObject({ code: "human_controlled" });
    lease.release();
  });
});

function fakeConnection(control = new BrowserControlState()) {
  const tabId = "11111111-1111-4111-8111-111111111111";
  const command = vi.fn(
    async (request: { method: string; params?: Record<string, unknown> }, _options?: unknown) => {
      switch (request.method) {
        case "listTabs":
          return [{ id: tabId, title: "Example", url: "https://example.com", selected: true }];
        case "navigate":
          return {
            tabId,
            title: "Navigation Result",
            url: request.params?.url || "https://example.com",
          };
        case "snapshot":
          return {
            tabId,
            title: "Example",
            url: "https://example.com",
            snapshot: "- document",
            truncated: false,
          };
        case "screenshot":
          return {
            metadata: { tabId, title: "Example", url: "https://example.com" },
            pngBase64: Buffer.from("png").toString("base64"),
          };
        default:
          return undefined;
      }
    },
  );
  const backend: AutomationBackend = {
    closed: false,
    command: async <T>(
      request: Parameters<AutomationBackend["command"]>[0],
      options: Parameters<AutomationBackend["command"]>[1],
    ) => command(request, options) as Promise<T>,
    disconnect: vi.fn(),
    onDisconnected: vi.fn(() => () => undefined),
  };
  return {
    command,
    connection: new PlaywrightBrowserConnectionImpl({ backend, control }),
  };
}
