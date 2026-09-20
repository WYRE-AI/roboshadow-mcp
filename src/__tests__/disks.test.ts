import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDiskTool } from '../tools/disks.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleDiskTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function callAndExpectPath(toolName: string, args: Record<string, unknown>, expectedPath: string) {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    const result = await runWithCredentials(creds, () => handleDiskTool(toolName, args));

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe(expectedPath);
  }

  it('roboshadow_get_device_disks hits GET .../device/{deviceId}/disks', () =>
    callAndExpectPath(
      'roboshadow_get_device_disks',
      { organisationId: 'org-1', deviceId: 'dev-1' },
      '/windows/organisation/org-1/device/dev-1/disks'
    ));

  it('roboshadow_get_disk_shares hits GET .../disks/{diskId}/shares', () =>
    callAndExpectPath(
      'roboshadow_get_disk_shares',
      { organisationId: 'org-1', deviceId: 'dev-1', diskId: 'disk-1' },
      '/windows/organisation/org-1/device/dev-1/disks/disk-1/shares'
    ));

  it('roboshadow_get_disk_report hits GET .../reports/disks', () =>
    callAndExpectPath('roboshadow_get_disk_report', { organisationId: 'org-1' }, '/windows/organisation/org-1/reports/disks'));

  it('roboshadow_get_disk_report_by_device hits GET .../reports/disks/bydevice', () =>
    callAndExpectPath(
      'roboshadow_get_disk_report_by_device',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/disks/bydevice'
    ));

  it('roboshadow_get_disk_summary hits GET .../reports/disks/summary', () =>
    callAndExpectPath(
      'roboshadow_get_disk_summary',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/disks/summary'
    ));
});
