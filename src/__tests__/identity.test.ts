import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleIdentityTool } from '../tools/identity.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse, textOf } from './test-helpers.js';

describe('handleIdentityTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_list_organisations hits GET /identity/organisation', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'org-1', name: 'Acme' }]));

    const result = await runWithCredentials(creds, () => handleIdentityTool('roboshadow_list_organisations', {}));

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/identity/organisation');
    expect(JSON.parse(textOf(result))[0].id).toBe('org-1');
  });

  it('roboshadow_list_organisation_users hits GET /identity/organisation/{id}/users', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse([{ email: 'a@b.com', displayName: 'A B' }]));

    const result = await runWithCredentials(creds, () =>
      handleIdentityTool('roboshadow_list_organisation_users', { organisationId: 'org-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/identity/organisation/org-1/users');
  });

  it('returns a credential error without calling fetch when no refresh token is configured', async () => {
    const result = await handleIdentityTool('roboshadow_list_organisations', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ROBOSHADOW_REFRESH_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a 403 as a readable auth error rather than throwing', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'forbidden' }, 403));

    const result = await runWithCredentials(creds, () => handleIdentityTool('roboshadow_list_organisations', {}));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/rejected the request/i);
  });
});
