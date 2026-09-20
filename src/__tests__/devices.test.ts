import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDeviceTool } from '../tools/devices.js';
import { runWithCredentials } from '../client.js';
import { bearerTokenResponse, freshCreds, jsonResponse } from './test-helpers.js';

describe('handleDeviceTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roboshadow_list_devices hits GET /windows/organisation/{orgId}/device', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ pagedData: [], totalItems: 0 }));

    const result = await runWithCredentials(creds, () =>
      handleDeviceTool('roboshadow_list_devices', { organisationId: 'org-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/device');
  });

  it('roboshadow_get_device hits GET .../device/{deviceId}', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ deviceName: 'PC-1' }));

    const result = await runWithCredentials(creds, () =>
      handleDeviceTool('roboshadow_get_device', { organisationId: 'org-1', deviceId: 'dev-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/device/dev-1');
  });

  it('roboshadow_get_device_user_profiles hits GET .../device/{deviceId}/userprofiles', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ deviceId: 'dev-1', organisationId: 'org-1', userProfiles: [] }));

    const result = await runWithCredentials(creds, () =>
      handleDeviceTool('roboshadow_get_device_user_profiles', { organisationId: 'org-1', deviceId: 'dev-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/device/dev-1/userprofiles');
  });

  it('roboshadow_get_device_users hits GET .../device/{deviceId}/users', async () => {
    const creds = freshCreds();
    fetchMock.mockResolvedValueOnce(bearerTokenResponse());
    fetchMock.mockResolvedValueOnce(jsonResponse({ deviceId: 'dev-1', organisationId: 'org-1', users: [] }));

    const result = await runWithCredentials(creds, () =>
      handleDeviceTool('roboshadow_get_device_users', { organisationId: 'org-1', deviceId: 'dev-1' })
    );

    expect(result.isError).toBeUndefined();
    const [url] = fetchMock.mock.calls[1] as [string];
    expect(new URL(url).pathname).toBe('/windows/organisation/org-1/device/dev-1/users');
  });
});
