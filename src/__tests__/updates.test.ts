import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUpdateTool } from '../tools/updates.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleUpdateTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_get_device_updates hits GET .../device/{deviceId}/updates with category filters', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleUpdateTool('roboshadow_get_device_updates', { organisationId: 'org-1', deviceId: 'dev-1', critical: true })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/device/dev-1/updates');
    expect(parsed.searchParams.get('critical')).toBe('true');
  });

  it('roboshadow_get_updates_report_by_device hits GET .../reports/updates/bydevice', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleUpdateTool('roboshadow_get_updates_report_by_device', { organisationId: 'org-1', servers: true })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/reports/updates/bydevice');
    expect(parsed.searchParams.get('servers')).toBe('true');
  });

  it('roboshadow_get_updates_summary hits GET .../reports/updates/summary', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ counts: {} }));

    const result = await runWithCredentials(creds, () =>
      handleUpdateTool('roboshadow_get_updates_summary', { organisationId: 'org-1', days: 30 })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/reports/updates/summary');
    expect(parsed.searchParams.get('days')).toBe('30');
  });
});
