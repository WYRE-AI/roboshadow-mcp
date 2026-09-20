import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMfaTool } from '../tools/mfa.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse, textOf } from './test-helpers.js';

describe('handleMfaTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_get_mfa_report hits GET /microsoft/report/mfa with organisationId and skipPages', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasMoreData: false, securityDefaultsSetting: true, users: [] }));

    const result = await runWithCredentials(creds, () =>
      handleMfaTool('roboshadow_get_mfa_report', { organisationId: 'org-1', skipPages: 2 })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/microsoft/report/mfa');
    expect(parsed.searchParams.get('organisationId')).toBe('org-1');
    expect(parsed.searchParams.get('skipPages')).toBe('2');
  });
});
