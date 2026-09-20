import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleVulnerabilityTool } from '../tools/vulnerabilities.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleVulnerabilityTool', () => {
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

    const result = await runWithCredentials(creds, () => handleVulnerabilityTool(toolName, args));

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe(expectedPath);
  }

  it('roboshadow_get_device_vulnerability_summary hits GET .../report/vulnerabilities/summary', () =>
    callAndExpectPath(
      'roboshadow_get_device_vulnerability_summary',
      { organisationId: 'org-1', deviceId: 'dev-1' },
      '/windows/organisation/org-1/device/dev-1/report/vulnerabilities/summary'
    ));

  it('roboshadow_get_vulnerable_applications hits GET .../reports/vulnerabilities/applications', () =>
    callAndExpectPath(
      'roboshadow_get_vulnerable_applications',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/vulnerabilities/applications'
    ));

  it('roboshadow_get_cpe_vulnerabilities hits GET .../reports/vulnerabilities/cpes', () =>
    callAndExpectPath(
      'roboshadow_get_cpe_vulnerabilities',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/vulnerabilities/cpes'
    ));

  it('roboshadow_get_cve_vulnerabilities hits GET .../reports/vulnerabilities/cves', () =>
    callAndExpectPath(
      'roboshadow_get_cve_vulnerabilities',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/vulnerabilities/cves'
    ));

  it('roboshadow_get_cve_fixes hits GET .../cves/{cveId}/fixes', () =>
    callAndExpectPath(
      'roboshadow_get_cve_fixes',
      { organisationId: 'org-1', cveId: 'CVE-2024-1234' },
      '/windows/organisation/org-1/reports/vulnerabilities/cves/CVE-2024-1234/fixes'
    ));

  it('roboshadow_get_vulnerable_devices hits GET .../reports/vulnerabilities/devices', () =>
    callAndExpectPath(
      'roboshadow_get_vulnerable_devices',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/vulnerabilities/devices'
    ));

  it('roboshadow_get_vulnerabilities_summary hits GET .../reports/vulnerabilities/summary', () =>
    callAndExpectPath(
      'roboshadow_get_vulnerabilities_summary',
      { organisationId: 'org-1' },
      '/windows/organisation/org-1/reports/vulnerabilities/summary'
    ));
});
