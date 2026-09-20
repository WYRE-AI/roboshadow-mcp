import type { CallToolResult } from '../tools/types.js';

/** Extracts the text of the first content block, failing loudly if it isn't text. */
export function textOf(result: CallToolResult): string {
  const block = result.content?.[0];
  if (!block || block.type !== 'text') {
    throw new Error(`Expected a text content block, got: ${JSON.stringify(block)}`);
  }
  return block.text;
}

/** Builds a Response whose body is JSON, matching RoboShadow's response shape. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** A bearer-token-exchange success response, matching RoboShadow's BearerTokenResponse shape. */
export function bearerTokenResponse(accessToken = 'access-token-1', expiresIn = 3600): Response {
  return jsonResponse({ accessToken, expiresIn });
}

// client.ts caches the exchanged access token in a module-level Map keyed by
// refreshToken, so it survives across `it()` blocks within one test file
// (each file gets its own module instance, but multiple tests in the same
// file share it). A fixed refreshToken constant would make every test after
// the first skip the bearer-token-exchange call once the first test warms
// the cache - silently changing the expected fetchMock.mock.calls sequence
// depending on test order. Each call here mints a fresh refreshToken so
// every test starts with a guaranteed cache miss and thus a predictable
// [tokenExchange, dataCall] fetch sequence.
let credCounter = 0;
export function freshCreds(): { refreshToken: string } {
  credCounter += 1;
  return { refreshToken: `refresh-token-${credCounter}` };
}
