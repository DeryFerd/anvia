import type { Route } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { enforceNavigationPolicy } from "../src/internal/navigation-policy";
import type { BrowserNavigationPolicy } from "../src/types";

const allowAll: BrowserNavigationPolicy = { mode: "allow-all-http" };

describe("enforceNavigationPolicy", () => {
  it("aborts a top-level redirect that targets a private literal", async () => {
    const initial = fakeRoute("https://example.com/landing");
    await enforceNavigationPolicy(initial.route, allowAll);
    expect(initial.continue).toHaveBeenCalledTimes(1);
    expect(initial.abort).not.toHaveBeenCalled();

    // Chromium issues a fresh top-level navigation request for each redirect hop.
    const redirect = fakeRoute("http://169.254.169.254/latest/meta-data/");
    await enforceNavigationPolicy(redirect.route, allowAll);
    expect(redirect.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(redirect.continue).not.toHaveBeenCalled();
  });

  it("aborts literal destinations that an origins policy lists", async () => {
    const listed = fakeRoute("http://127.0.0.1:8080/admin");
    await enforceNavigationPolicy(listed.route, {
      mode: "origins",
      origins: ["http://127.0.0.1:8080"],
    });
    expect(listed.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(listed.continue).not.toHaveBeenCalled();
  });

  it("continues public destinations allowed by the policy", async () => {
    const listed = fakeRoute("https://example.com/page");
    await enforceNavigationPolicy(listed.route, {
      mode: "origins",
      origins: ["https://example.com"],
    });
    expect(listed.continue).toHaveBeenCalledTimes(1);
    expect(listed.abort).not.toHaveBeenCalled();

    const unlisted = fakeRoute("https://other.example/page");
    await enforceNavigationPolicy(unlisted.route, {
      mode: "origins",
      origins: ["https://example.com"],
    });
    expect(unlisted.abort).toHaveBeenCalledWith("blockedbyclient");
  });

  it("continues sub-resource and subframe requests", async () => {
    const subResource = fakeRoute("http://127.0.0.1:8080/logo.png", { navigation: false });
    await enforceNavigationPolicy(subResource.route, allowAll);
    expect(subResource.continue).toHaveBeenCalledTimes(1);
    expect(subResource.abort).not.toHaveBeenCalled();

    const subframe = fakeRoute("http://127.0.0.1:8080/frame", { mainFrame: false });
    await enforceNavigationPolicy(subframe.route, allowAll);
    expect(subframe.continue).toHaveBeenCalledTimes(1);
    expect(subframe.abort).not.toHaveBeenCalled();
  });
});

function fakeRoute(
  url: string,
  options: { navigation?: boolean; mainFrame?: boolean } = {},
): {
  route: Route;
  abort: ReturnType<typeof vi.fn>;
  continue: ReturnType<typeof vi.fn>;
} {
  const { navigation = true, mainFrame = true } = options;
  const abort = vi.fn(async () => undefined);
  const proceed = vi.fn(async () => undefined);
  const frame = { page: () => page };
  const otherFrame = { page: () => page };
  const page = { mainFrame: () => (mainFrame ? frame : otherFrame) };
  const route = {
    request: () => ({
      url: () => url,
      isNavigationRequest: () => navigation,
      frame: () => frame,
    }),
    abort,
    continue: proceed,
  } as unknown as Route;
  return { route, abort, continue: proceed };
}
