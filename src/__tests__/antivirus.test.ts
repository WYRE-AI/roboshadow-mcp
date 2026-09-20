import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAntivirusTool } from '../tools/antivirus.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleAntivirusTool', () => {
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

    const result = await runWithCredentials(creds, () => handleAntivirusTool(toolName, args));

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe(expectedPath);
  }

  it('roboshadow_get_device_antivirus hits GET .../device/{deviceId}/antivirus', () =>
    callAndExpectPath(
      'roboshadow_get_device_antivirus',
      { organisationId: 'org-1', deviceId: 'dev-1' },
      '/windows/organisation/org-1/device/dev-1/antivirus'
    ));

  it('roboshadow_get_antivirus_report_by_device hits GET .../reports/antivirus/bydevice', () =>
    callAndExpectPath(
      'roboshadow_get_antivirus_report_by_device',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/antivirus/bydevice'
    ));

  it('roboshadow_get_ransomware_report hits GET .../reports/antivirus/ransomware', () =>
    callAndExpectPath(
      'roboshadow_get_ransomware_report',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/antivirus/ransomware'
    ));

  it('roboshadow_get_antivirus_summary hits GET .../reports/antivirus/summary', () =>
    callAndExpectPath(
      'roboshadow_get_antivirus_summary',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/antivirus/summary'
    ));

  it('roboshadow_get_antivirus_threats hits GET .../reports/antivirus/threats', () =>
    callAndExpectPath(
      'roboshadow_get_antivirus_threats',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/antivirus/threats'
    ));

  it('roboshadow_get_windows_defender_report hits GET .../reports/antivirus/windowsdefenders', () =>
    callAndExpectPath(
      'roboshadow_get_windows_defender_report',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/antivirus/windowsdefenders'
    ));
});
