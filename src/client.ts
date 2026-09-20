import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './utils/logger.js';
import {
  RoboShadowApiError,
  RoboShadowAuthError,
  RoboShadowRateLimitError,
} from './types.js';
import type {
  ApplicationGroup,
  AvDevice,
  AvDeviceData,
  AvSummary,
  BearerTokenResponse,
  CveFix,
  DaysFilterParams,
  DeviceApplication,
  DeviceDisk,
  DeviceDiskEntry,
  DeviceUpdatesReportDto,
  DeviceUser,
  DeviceUserProfilesResponse,
  DeviceUsersResponse,
  DeviceVulnerabilitySummaryResponse,
  Device,
  DiskDevice,
  DiskSummary,
  Firewall,
  GetMfaReportParams,
  HardwareReport,
  HardwareSummary,
  ListDevicesParams,
  MfaResponse,
  Organisation,
  OrganisationUser,
  OverallScanStatus,
  PagedResponse,
  RansomwareDevice,
  RemediationAttemptCves,
  RemediationReport,
  RemediationReportParams,
  ReportPageParams,
  RoboShadowCredentials,
  ScanStatusListParams,
  ScanStatusListResponse,
  ScanSummary,
  Share,
  TargetOverview,
  UpdatesByDeviceParams,
  UpdatesSummaryResponse,
  VulAppSummary,
  VulCveSummary,
  VulDeviceSummary,
  VulnerabilitiesSummaryResponse,
  WindowsDefenderDevice,
  WindowsService,
} from './types.js';

export const BASE_URL = 'https://api.roboshadow.com';

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({refreshToken}); getCredentials() reads
// from it. Falls back to process.env for stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<RoboShadowCredentials>();

export function runWithCredentials<T>(creds: RoboShadowCredentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): RoboShadowCredentials | null {
  const scoped = credStore.getStore();
  if (scoped?.refreshToken) return scoped;
  const refreshToken = process.env.ROBOSHADOW_REFRESH_TOKEN;
  if (!refreshToken) {
    logger.warn('Missing credentials', { hasRefreshToken: !!refreshToken });
    return null;
  }
  return { refreshToken };
}

// ---------------------------------------------------------------------
// Bearer-token exchange (POST /identity/bearertoken)
//
// RoboShadow's Bearer Token is a short-lived Firebase JWT (~1hr, per the
// vendor's own BearerTokenResponse.expiresIn). This connector stores the
// long-lived Refresh Token as its credential and exchanges it here for a
// fresh Bearer Token before every data call, caching the result in-process
// (keyed by refresh token) until shortly before it expires. This exchange
// is the ONE non-GET call this connector makes - it is RoboShadow's own
// documented credential-refresh mechanism (OpenAPI tag: Authentication),
// not a data mutation.
// ---------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/** Buffer subtracted from expiresIn so a token is refreshed before it actually expires mid-request. */
const EXPIRY_BUFFER_MS = 60_000;

async function exchangeRefreshToken(refreshToken: string): Promise<BearerTokenResponse> {
  const res = await fetch(`${BASE_URL}/identity/bearertoken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new RoboShadowAuthError(
      `RoboShadow rejected the refresh token (HTTP 400): ${body.message ?? 'invalid or expired refresh token'}`
    );
  }
  if (res.status === 429) {
    throw new RoboShadowRateLimitError('RoboShadow rate-limited the bearer-token exchange (HTTP 429)');
  }
  if (!res.ok) {
    throw new RoboShadowApiError(`RoboShadow bearer-token exchange failed: HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as BearerTokenResponse;
}

async function getAccessToken(creds: RoboShadowCredentials): Promise<string> {
  const cached = tokenCache.get(creds.refreshToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }
  const { accessToken, expiresIn } = await exchangeRefreshToken(creds.refreshToken);
  tokenCache.set(creds.refreshToken, {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000 - EXPIRY_BUFFER_MS,
  });
  return accessToken;
}

// ---------------------------------------------------------------------
// GET request helper
// ---------------------------------------------------------------------

function buildQuery(params: Record<string, unknown> = {}): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    qs.append(key, String(value));
  }
  return qs;
}

async function doGet<T>(
  creds: RoboShadowCredentials,
  path: string,
  query?: Record<string, unknown>
): Promise<T> {
  const accessToken = await getAccessToken(creds);
  const qs = query ? buildQuery(query).toString() : '';
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  // RoboShadow's data endpoints document 400/403/404 responses, not 401 -
  // an invalid/expired bearer token surfaces as 403 Forbidden here (the
  // vendor's own spec never documents a 401 on any data path).
  if (res.status === 403) {
    throw new RoboShadowAuthError(`RoboShadow rejected the request (HTTP 403): ${path}`);
  }
  if (res.status === 429) {
    throw new RoboShadowRateLimitError(`RoboShadow rate-limited the request (HTTP 429): ${path}`);
  }
  if (!res.ok) {
    throw new RoboShadowApiError(`RoboShadow ${path} failed: HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------
// Identity - GET /identity/organisation, GET /identity/organisation/{id}/users
// ---------------------------------------------------------------------

/** GET /identity/organisation - organisations visible to the authenticated refresh token. */
export async function listOrganisations(creds: RoboShadowCredentials): Promise<Organisation[]> {
  return doGet(creds, '/identity/organisation');
}

/** GET /identity/organisation/{organisation_id}/users - users belonging to one organisation. */
export async function listOrganisationUsers(
  creds: RoboShadowCredentials,
  organisationId: string
): Promise<OrganisationUser[]> {
  return doGet(creds, `/identity/organisation/${encodeURIComponent(organisationId)}/users`);
}

// ---------------------------------------------------------------------
// MFA - GET /microsoft/report/mfa
// ---------------------------------------------------------------------

/** GET /microsoft/report/mfa - paged MFA status report for a Microsoft-identity-linked organisation. */
export async function getMfaReport(
  creds: RoboShadowCredentials,
  params: GetMfaReportParams
): Promise<MfaResponse> {
  return doGet(creds, '/microsoft/report/mfa', { ...params });
}

// ---------------------------------------------------------------------
// Vulnerability Scanner - GET /vscanner/scans/{organisationId}/*
// ---------------------------------------------------------------------

/** GET /vscanner/scans/{organisationId}/ips-overview/{scanId} - per-target CVE/port breakdown for one scan. */
export async function getScanIpsOverview(
  creds: RoboShadowCredentials,
  organisationId: string,
  scanId: string
): Promise<TargetOverview[]> {
  return doGet(creds, `/vscanner/scans/${encodeURIComponent(organisationId)}/ips-overview/${encodeURIComponent(scanId)}`);
}

/** GET /vscanner/scans/{organisationId}/status - paged status summary of every vulnerability scan. */
export async function listScanStatus(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ScanStatusListParams = {}
): Promise<ScanStatusListResponse> {
  return doGet(creds, `/vscanner/scans/${encodeURIComponent(organisationId)}/status`, { ...params });
}

/** GET /vscanner/scans/{organisationId}/summary/{scanId} - detailed summary of one vulnerability scan. */
export async function getScanSummary(
  creds: RoboShadowCredentials,
  organisationId: string,
  scanId: string
): Promise<ScanSummary> {
  return doGet(creds, `/vscanner/scans/${encodeURIComponent(organisationId)}/summary/${encodeURIComponent(scanId)}`);
}

// ---------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/applications/groups - grouped applications with vulnerability counts. */
export async function listApplicationGroups(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams & { sortBy?: string; sortDesc?: boolean; search?: string } = {}
): Promise<PagedResponse<ApplicationGroup>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/applications/groups`, { ...params });
}

/** GET /windows/organisation/{organisationId}/applications/groups/{group_id} - detail for one application group. */
export async function getApplicationGroup(
  creds: RoboShadowCredentials,
  organisationId: string,
  groupId: string
): Promise<ApplicationGroup> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/applications/groups/${encodeURIComponent(groupId)}`
  );
}

/** GET /windows/organisation/{organisationId}/device/{deviceId}/applications - applications installed on one device. */
export async function getDeviceApplications(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string,
  params: ReportPageParams & { search?: string } = {}
): Promise<PagedResponse<DeviceApplication>> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/applications`,
    { ...params }
  );
}

// ---------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/device - every device in the organisation. */
export async function listDevices(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ListDevicesParams = {}
): Promise<PagedResponse<Device>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/device`, { ...params });
}

/** GET /windows/organisation/{organisationId}/device/{deviceId} - detail for one device. */
export async function getDevice(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string
): Promise<Device> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}`);
}

/** GET /windows/organisation/{organisationId}/device/{deviceId}/userprofiles - Windows user profiles present on one device. */
export async function getDeviceUserProfiles(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string
): Promise<DeviceUserProfilesResponse> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/userprofiles`
  );
}

/** GET /windows/organisation/{organisationId}/device/{deviceId}/users - local/AD users on one device. */
export async function getDeviceUsers(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string
): Promise<DeviceUsersResponse> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/users`
  );
}

// ---------------------------------------------------------------------
// Antivirus / Defender
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/device/{deviceId}/antivirus - antivirus state for one device. */
export async function getDeviceAntivirus(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string
): Promise<AvDeviceData> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/antivirus`
  );
}

/** GET /windows/organisation/{organisationId}/reports/antivirus/bydevice - antivirus status grouped by device. */
export async function getAntivirusReportByDevice(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<AvDevice>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/antivirus/bydevice`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/antivirus/ransomware - ransomware protection status by device. */
export async function getRansomwareReport(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<RansomwareDevice>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/antivirus/ransomware`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/antivirus/summary - organisation-wide antivirus summary. */
export async function getAntivirusSummary(
  creds: RoboShadowCredentials,
  organisationId: string
): Promise<AvSummary> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/antivirus/summary`);
}

/** GET /windows/organisation/{organisationId}/reports/antivirus/threats - detected antivirus threats. */
export async function getAntivirusThreats(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
) {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/antivirus/threats`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/antivirus/windowsdefenders - Windows Defender status report. */
export async function getWindowsDefenderReport(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<WindowsDefenderDevice>> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/reports/antivirus/windowsdefenders`,
    { ...params }
  );
}

// ---------------------------------------------------------------------
// Firewall
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/reports/firewalls - firewall status across the organisation. */
export async function getFirewallReport(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<Firewall>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/firewalls`, { ...params });
}

// ---------------------------------------------------------------------
// Disks
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/device/{deviceId}/disks - disks present on one device. */
export async function getDeviceDisks(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string
): Promise<DeviceDiskEntry[]> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/disks`
  );
}

/** GET .../device/{deviceId}/disks/{diskId}/shares - network shares on one disk. */
export async function getDiskShares(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string,
  diskId: string
): Promise<Share[]> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/disks/${encodeURIComponent(diskId)}/shares`
  );
}

/** GET /windows/organisation/{organisationId}/reports/disks - disk usage across the organisation. */
export async function getDiskReport(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<DiskDevice>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/disks`, { ...params });
}

/** GET /windows/organisation/{organisationId}/reports/disks/bydevice - disk information grouped by device. */
export async function getDiskReportByDevice(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<DeviceDisk>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/disks/bydevice`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/disks/summary - organisation-wide disk usage summary. */
export async function getDiskSummary(
  creds: RoboShadowCredentials,
  organisationId: string
): Promise<DiskSummary> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/disks/summary`);
}

// ---------------------------------------------------------------------
// Hardware
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/reports/hardware/bydevice - hardware information grouped by device. */
export async function getHardwareReportByDevice(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<HardwareReport>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/hardware/bydevice`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/hardware/summary - organisation-wide hardware summary. */
export async function getHardwareSummary(
  creds: RoboShadowCredentials,
  organisationId: string
): Promise<HardwareSummary> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/hardware/summary`);
}

// ---------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/device/{deviceId}/services - Windows services running on one device. */
export async function getDeviceServices(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string,
  params: ReportPageParams & { search?: string } = {}
): Promise<PagedResponse<WindowsService>> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/services`,
    { ...params }
  );
}

// ---------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/device/{deviceId}/updates - missing updates for one device. */
export async function getDeviceUpdates(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string,
  params: ReportPageParams & UpdatesByDeviceParams = {}
): Promise<PagedResponse<DeviceUpdatesReportDto>> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/updates`,
    { ...params }
  );
}

/** GET /windows/organisation/{organisationId}/reports/updates/bydevice - paginated missing-updates report grouped by device. */
export async function getUpdatesReportByDevice(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: UpdatesByDeviceParams = {}
): Promise<PagedResponse<DeviceUpdatesReportDto>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/updates/bydevice`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/updates/summary - update summary statistics and top devices. */
export async function getUpdatesSummary(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: DaysFilterParams = {}
): Promise<UpdatesSummaryResponse> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/updates/summary`, {
    ...params,
  });
}

// ---------------------------------------------------------------------
// Vulnerabilities
// ---------------------------------------------------------------------

/** GET .../device/{deviceId}/report/vulnerabilities/summary - vulnerability summary for one device. */
export async function getDeviceVulnerabilitySummary(
  creds: RoboShadowCredentials,
  organisationId: string,
  deviceId: string
): Promise<DeviceVulnerabilitySummaryResponse> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/device/${encodeURIComponent(deviceId)}/report/vulnerabilities/summary`
  );
}

/** GET /windows/organisation/{organisationId}/reports/vulnerabilities/applications - vulnerable applications across the organisation. */
export async function getVulnerableApplications(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams & DaysFilterParams = {}
): Promise<PagedResponse<VulAppSummary>> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/reports/vulnerabilities/applications`,
    { ...params }
  );
}

/** GET /windows/organisation/{organisationId}/reports/vulnerabilities/cpes - CPE vulnerability report. */
export async function getCpeVulnerabilities(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams = {}
): Promise<PagedResponse<VulAppSummary>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/vulnerabilities/cpes`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/vulnerabilities/cves - CVEs affecting the organisation. */
export async function getCveVulnerabilities(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams & DaysFilterParams = {}
): Promise<PagedResponse<VulCveSummary>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/vulnerabilities/cves`, {
    ...params,
  });
}

/** GET .../reports/vulnerabilities/cves/{cveId}/fixes - available fixes/patches for one CVE. */
export async function getCveFixes(
  creds: RoboShadowCredentials,
  organisationId: string,
  cveId: string
): Promise<CveFix[]> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/reports/vulnerabilities/cves/${encodeURIComponent(cveId)}/fixes`
  );
}

/** GET /windows/organisation/{organisationId}/reports/vulnerabilities/devices - devices with vulnerabilities. */
export async function getVulnerableDevices(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: ReportPageParams & DaysFilterParams = {}
): Promise<PagedResponse<VulDeviceSummary>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/vulnerabilities/devices`, {
    ...params,
  });
}

/** GET /windows/organisation/{organisationId}/reports/vulnerabilities/summary - vulnerabilities summary across the organisation. */
export async function getVulnerabilitiesSummary(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: DaysFilterParams = {}
): Promise<VulnerabilitiesSummaryResponse> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/vulnerabilities/summary`, {
    ...params,
  });
}

// ---------------------------------------------------------------------
// Remediation
// ---------------------------------------------------------------------

/** GET /windows/organisation/{organisationId}/reports/remediation-report - detailed vulnerability remediation report. */
export async function getRemediationReport(
  creds: RoboShadowCredentials,
  organisationId: string,
  params: RemediationReportParams = {}
): Promise<PagedResponse<RemediationReport>> {
  return doGet(creds, `/windows/organisation/${encodeURIComponent(organisationId)}/reports/remediation-report`, {
    ...params,
  });
}

/** GET .../reports/remediation-report/{attemptId}/cves - CVEs addressed by one remediation attempt. */
export async function getRemediationAttemptCves(
  creds: RoboShadowCredentials,
  organisationId: string,
  attemptId: string
): Promise<RemediationAttemptCves> {
  return doGet(
    creds,
    `/windows/organisation/${encodeURIComponent(organisationId)}/reports/remediation-report/${encodeURIComponent(attemptId)}/cves`
  );
}
