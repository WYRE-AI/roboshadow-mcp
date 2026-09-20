import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleFirewallTool } from '../tools/firewall.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleFirewallTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_get_firewall_report hits GET /windows/organisation/{orgId}/reports/firewalls', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleFirewallTool('roboshadow_get_firewall_report', { organisationId: 'org-1', page: 2 })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/reports/firewalls');
    expect(parsed.searchParams.get('page')).toBe('2');
  });
});
