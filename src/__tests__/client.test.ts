import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listOrganisations } from '../client.js';
import { RoboShadowApiError, RoboShadowAuthError, RoboShadowRateLimitError } from '../types.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('bearer-token exchange (client.ts getAccessToken)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges the refresh token for a bearer token before the first data call', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse('access-1'));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'org-1', name: 'Acme' }]));

    await listOrganisations(creds);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [exchangeUrl, exchangeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(exchangeUrl).pathname).toBe('/identity/bearertoken');
    expect(exchangeInit.method).toBe('POST');
    expect(JSON.parse(exchangeInit.body as string)).toEqual({ refreshToken: creds.refreshToken });

    const [dataUrl, dataInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new URL(dataUrl).pathname).toBe('/identity/organisation');
    expect((dataInit.headers as Record<string, string>)['Authorization']).toBe('Bearer access-1');
  });

  it('caches the access token and does not re-exchange on a second call within its lifetime', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse('access-2'));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await listOrganisations(creds);

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await listOrganisations(creds);

    // 2 calls for the first listOrganisations (exchange + data), 1 for the
    // second (data only - the cached token is reused).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [thirdUrl] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new URL(thirdUrl).pathname).toBe('/identity/organisation');
  });

  it('throws RoboShadowAuthError when the refresh token is rejected (HTTP 400)', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Invalid Request', statusCode: 400 }, 400));

    await expect(listOrganisations(creds)).rejects.toThrow(RoboShadowAuthError);
    await expect(listOrganisations(creds)).rejects.toThrow(/refresh token/i);
  });

  it('throws RoboShadowRateLimitError when the exchange is rate-limited (HTTP 429)', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValue(jsonResponse({ message: 'slow down' }, 429));

    await expect(listOrganisations(creds)).rejects.toThrow(RoboShadowRateLimitError);
  });

  it('throws RoboShadowAuthError when a data call is rejected (HTTP 403)', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse('access-3'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'forbidden' }, 403));

    await expect(listOrganisations(creds)).rejects.toThrow(RoboShadowAuthError);
  });

  it('throws RoboShadowApiError for any other non-2xx data response', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse('access-4'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, 500));

    await expect(listOrganisations(creds)).rejects.toThrow(RoboShadowApiError);
  });
});
