import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleServiceTool } from '../tools/services.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleServiceTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_get_device_services hits GET .../device/{deviceId}/services', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleServiceTool('roboshadow_get_device_services', { organisationId: 'org-1', deviceId: 'dev-1', search: 'spooler' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/device/dev-1/services');
    expect(parsed.searchParams.get('search')).toBe('spooler');
  });
});
