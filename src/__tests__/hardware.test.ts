import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleHardwareTool } from '../tools/hardware.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleHardwareTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_get_hardware_report_by_device hits GET .../reports/hardware/bydevice', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleHardwareTool('roboshadow_get_hardware_report_by_device', { organisationId: 'org-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/reports/hardware/bydevice');
  });

  it('roboshadow_get_hardware_summary hits GET .../reports/hardware/summary', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ totalEolOs: 0, totalMachines: 10, totalServers: 2, totalWorkstations: 8 })
    );

    const result = await runWithCredentials(creds, () =>
      handleHardwareTool('roboshadow_get_hardware_summary', { organisationId: 'org-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/reports/hardware/summary');
  });
});
