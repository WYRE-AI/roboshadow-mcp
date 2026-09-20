import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleVscannerTool } from '../tools/vscanner.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse, textOf } from './test-helpers.js';

describe('handleVscannerTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_list_scan_status hits GET /vscanner/scans/{orgId}/status', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleVscannerTool('roboshadow_list_scan_status', { organisationId: 'org-1', status: 'complete' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/vscanner/scans/org-1/status');
    expect(parsed.searchParams.get('status')).toBe('complete');
  });

  it('roboshadow_get_scan_summary hits GET /vscanner/scans/{orgId}/summary/{scanId}', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ scanDetails: {}, ipSummary: {}, webSummary: {} }));

    const result = await runWithCredentials(creds, () =>
      handleVscannerTool('roboshadow_get_scan_summary', { organisationId: 'org-1', scanId: 'scan-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/vscanner/scans/org-1/summary/scan-1');
  });

  it('roboshadow_get_scan_ips_overview hits GET /vscanner/scans/{orgId}/ips-overview/{scanId}', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const result = await runWithCredentials(creds, () =>
      handleVscannerTool('roboshadow_get_scan_ips_overview', { organisationId: 'org-1', scanId: 'scan-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/vscanner/scans/org-1/ips-overview/scan-1');
    expect(textOf(result)).toBe('[]');
  });
});
