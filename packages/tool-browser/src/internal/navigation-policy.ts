/**
 * Shared navigation policy checks.
 *
 * Used by the tool layer (tools.ts) to reject a navigation before it is dispatched and
 * by the worker's route handler (automation-worker.ts) to re-check every top-level
 * navigation request, so a redirect cannot reach a destination the policy forbids.
 */
import type { Route } from "playwright-core";
import type { BrowserNavigationPolicy } from "../types";
import { isPrivateOrReservedHost } from "./ip-check";

export function isNavigationAllowed(value: string, policy: BrowserNavigationPolicy): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username.length > 0 || url.password.length > 0) return false;

  // Private and reserved literal destinations stay blocked under every policy mode.
  if (isPrivateOrReservedHost(url.hostname)) return false;

  return policy.mode === "allow-all-http" || policy.origins.includes(url.origin);
}

/**
 * Abort top-level navigation requests that the policy rejects, including each redirect
 * hop Chromium follows after an allowed initial navigation.
 */
export async function enforceNavigationPolicy(
  route: Route,
  policy: BrowserNavigationPolicy,
): Promise<void> {
  const request = route.request();
  const frame = request.frame();
  if (
    request.isNavigationRequest() &&
    frame === frame.page().mainFrame() &&
    !isNavigationAllowed(request.url(), policy)
  ) {
    await route.abort("blockedbyclient");
    return;
  }
  await route.continue();
}
