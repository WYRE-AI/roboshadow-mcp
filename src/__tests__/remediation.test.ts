import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRemediationTool } from '../tools/remediation.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleRemediationTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_get_remediation_report hits GET .../reports/remediation-report', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleRemediationTool('roboshadow_get_remediation_report', { organisationId: 'org-1', days: 7 })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/windows/organisation/org-1/reports/remediation-report');
    expect(parsed.searchParams.get('days')).toBe('7');
  });

  it('roboshadow_get_remediation_attempt_cves hits GET .../remediation-report/{attemptId}/cves', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ cveIds: [], details: {} }));

    const result = await runWithCredentials(creds, () =>
      handleRemediationTool('roboshadow_get_remediation_attempt_cves', { organisationId: 'org-1', attemptId: 'attempt-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/reports/remediation-report/attempt-1/cves');
  });
});
