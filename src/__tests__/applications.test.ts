import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApplicationTool } from '../tools/applications.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleApplicationTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_list_application_groups hits GET /windows/organisation/{orgId}/applications/groups', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleApplicationTool('roboshadow_list_application_groups', { organisationId: 'org-1', search: 'Chrome' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/applications/groups');
    expect(parsed.searchParams.get('search')).toBe('Chrome');
  });

  it('roboshadow_get_application_group hits GET .../applications/groups/{group_id}', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ applicationId: 'grp-1', name: 'Chrome' }));

    const result = await runWithCredentials(creds, () =>
      handleApplicationTool('roboshadow_get_application_group', { organisationId: 'org-1', group_id: 'grp-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/applications/groups/grp-1');
  });

  it('roboshadow_get_device_applications hits GET .../device/{deviceId}/applications', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleApplicationTool('roboshadow_get_device_applications', { organisationId: 'org-1', deviceId: 'dev-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/device/dev-1/applications');
  });
});
