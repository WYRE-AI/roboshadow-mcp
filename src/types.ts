/**
 * RoboShadow's Rubicon Platform Data API authenticates with a short-lived
 * Firebase JWT Bearer token (`bearerFormat: JWT` in the vendor's own
 * `components.securitySchemes.BearerAuth`, ~1hr `expiresIn`) obtained by
 * exchanging a long-lived Refresh Token via `POST /identity/bearertoken`.
 * RoboShadow's own portal (Reports -> API Token) hands the customer both
 * values together, but only the Refresh Token is durable enough to store as
 * a connector credential — a Bearer Token pasted in once would go stale
 * within the hour. This connector stores the Refresh Token and performs the
 * exchange itself (see client.ts's `getAccessToken`), caching the resulting
 * Bearer Token until shortly before it expires.
 *
 * Structurally verified (checked directly): this connector's own code makes
 * zero mutating calls against RoboShadow's data API — every function in
 * client.ts calls one of the 40 dedicated GET read operations in the
 * published OpenAPI spec (`https://cdn.development.roboshadow.com/publicapi/openapi.yaml`,
 * fetched directly). The ONE non-GET call this connector makes at all is
 * `POST /identity/bearertoken` itself, which is the vendor's own documented
 * credential-refresh mechanism (tag: Authentication), not a data mutation —
 * the spec defines no write/create/update/delete operation anywhere for
 * organisation data. RoboShadow's Rubicon Platform Data API is read-only by
 * design: there is no endpoint in the entire spec that mutates an
 * organisation's devices, applications, users, or reports.
 */
export interface RoboShadowCredentials {
  refreshToken: string;
}

/** Thrown when RoboShadow rejects the refresh token during the bearer-token exchange (HTTP 400 from POST /identity/bearertoken). */
export class RoboShadowAuthError extends Error {}

/** Thrown when RoboShadow rate-limits the request (HTTP 429) - distinct from an auth failure. */
export class RoboShadowRateLimitError extends Error {}

/** Thrown for any other non-2xx / unexpected vendor response (400/403/404/5xx from a data endpoint). */
export class RoboShadowApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

// ---------------------------------------------------------------------
// Authentication - POST /identity/bearertoken
// ---------------------------------------------------------------------

export interface BearerTokenResponse {
  /** Firebase JWT access token (bearer token) for API authentication. */
  accessToken: string;
  /** Token expiration time in seconds. */
  expiresIn: number;
}

// ---------------------------------------------------------------------
// Shared envelope / pagination
// ---------------------------------------------------------------------

export interface PageParams {
  page?: number;
  itemsPerPage?: number;
}

export interface SortParams {
  sortBy?: string;
  sortDesc?: boolean;
}

export interface SearchParams {
  search?: string;
}

export interface DaysFilterParams {
  days?: number;
}

/** Common response envelope shape used by every paginated report endpoint. */
export interface PagedResponse<T> {
  pagedData: T[];
  totalItems: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Identity - GET /identity/organisation, GET /identity/organisation/{id}/users
// ---------------------------------------------------------------------

export interface Organisation {
  id: string;
  name: string;
  permissions?: { id: number; name: string };
  [key: string]: unknown;
}

export interface OrganisationUser {
  created: number;
  displayName: string;
  email: string;
  externalId: string;
  permission: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// MFA - GET /microsoft/report/mfa
// ---------------------------------------------------------------------

export interface GetMfaReportParams {
  organisationId: string;
  /** Zero-based page number to skip to (page size is 5000). */
  skipPages?: number;
}

export interface UserMfaDetails {
  accountEnabled: boolean;
  adId: string;
  displayName?: string | null;
  globalAdministrator: boolean;
  id: string;
  lastSignIn?: number | null;
  methodsRegistered: string;
  /** 0=Disabled, 1=Enabled, 2=SecurityDefaults, 3=Unknown */
  mfaStatus: 0 | 1 | 2 | 3;
  userPrincipalName: string;
  userType?: string | null;
  [key: string]: unknown;
}

export interface MfaResponse {
  hasMoreData: boolean;
  securityDefaultsSetting: boolean;
  users: UserMfaDetails[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Vulnerability Scanner - GET /vscanner/scans/{organisationId}/*
// ---------------------------------------------------------------------

export interface TargetOverview {
  alerts?: number | null;
  apps?: number | null;
  cidr?: string | null;
  criticalCves?: number | null;
  description?: string | null;
  domain?: string | null;
  domains: string[];
  filteredPorts: number;
  highCves?: number | null;
  ipAddress?: string | null;
  lowCves?: number | null;
  mediumCves?: number | null;
  noneCves?: number | null;
  ports?: number | null;
  status: string;
  [key: string]: unknown;
}

export interface ScanStatusListParams extends PageParams, SortParams {
  isScheduled?: boolean;
  status?: string;
}

export interface OverallScanStatus {
  scanId: string;
  scanName: string;
  scanType: string;
  status: string;
  isActiveScan: boolean;
  isSuccessful?: boolean | null;
  dateCreated: string;
  dateStarted: string;
  dateEnded?: string | null;
  organisationId: string;
  userId: string;
  cves?: number | null;
  alerts?: number | null;
  ports?: number | null;
  filteredPorts: number;
  [key: string]: unknown;
}

export interface ScanStatusListResponse {
  items: OverallScanStatus[];
  total: number;
}

export interface ScanSummary {
  scanDetails: Record<string, unknown>;
  ipSummary: Record<string, unknown>;
  webSummary: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Applications - GET /windows/organisation/{organisationId}/applications/*,
// GET .../device/{deviceId}/applications
// ---------------------------------------------------------------------

export interface ApplicationGroup {
  applicationId: string;
  name: string;
  vendor: string;
  count: number;
  deviceCount: number;
  versions: number;
  topWinGetPackage?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface DeviceApplication {
  applicationId: string;
  applicationName: string;
  applicationVendor: string;
  applicationVersion: string;
  deviceId: string;
  deviceName?: string | null;
  deviceType?: string | null;
  lastSeen?: number | null;
  user?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Devices - GET /windows/organisation/{organisationId}/device[/{deviceId}]
// ---------------------------------------------------------------------

export interface Device {
  deviceName?: string | null;
  externalDeviceId?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  isOnline: boolean;
  licensed: boolean;
  loggedOnUser?: string | null;
  machineType?: string | null;
  operatingSystemName?: string | null;
  osVersion?: string | null;
  serialNumber?: string | null;
  netScore?: number | null;
  cvesCritical?: number | null;
  cvesHigh?: number | null;
  updatesCritical?: number | null;
  updatesSecurity?: number | null;
  rebootRequired: boolean;
  [key: string]: unknown;
}

export interface ListDevicesParams extends PageParams, SearchParams, SortParams {}

export interface DeviceUserProfile {
  fullProfile: boolean;
  id: string;
  path: string;
  sid: string;
  [key: string]: unknown;
}

export interface DeviceUserProfilesResponse {
  deviceId: string;
  organisationId: string;
  userProfiles: DeviceUserProfile[];
}

export interface DeviceUser {
  displayName?: string | null;
  emailAddress?: string | null;
  employeeId?: string | null;
  enabled?: boolean | null;
  givenName?: string | null;
  id?: string | null;
  isAdmin: boolean;
  lastLogon?: number | null;
  name?: string | null;
  samAccountName?: string | null;
  sid?: string | null;
  surname?: string | null;
  userPrincipalName?: string | null;
  [key: string]: unknown;
}

export interface DeviceUsersResponse {
  deviceId: string;
  organisationId: string;
  users: DeviceUser[];
}

// ---------------------------------------------------------------------
// Antivirus - GET .../device/{deviceId}/antivirus,
// GET .../reports/antivirus/*
// ---------------------------------------------------------------------

export interface AvThreat {
  agentType: number;
  deviceName?: string | null;
  isActive?: boolean | null;
  severity: string;
  threatId?: number | null;
  threatName?: string | null;
  [key: string]: unknown;
}

export interface AvDeviceData {
  antivirusEnabled?: boolean | null;
  antivirusName?: string | null;
  realTimeProtectionEnabled?: boolean | null;
  tamperProtectionStatus?: boolean | null;
  threats: AvThreat[];
  [key: string]: unknown;
}

export interface AvDevice {
  deviceName?: string | null;
  isAnyAv: boolean;
  isAvEnabled?: boolean | null;
  isFireWallEnabled?: boolean | null;
  ransomwareEnabled?: boolean | null;
  realTimeProtectionEnabled?: boolean | null;
  threatsCount: number;
  [key: string]: unknown;
}

export interface RansomwareDevice {
  antivirusName?: string | null;
  deviceName?: string | null;
  isOnline: boolean;
  licensed: boolean;
  ransomwareEnabled?: boolean | null;
  [key: string]: unknown;
}

export interface AvSummary {
  activeThreatsCount: number;
  totalDevices: number;
  thirdPartyAVCount: number;
  windowsDefenderCount: number;
  openFirewallCount: number;
  pendingDefUpdatesCount: number;
  noRansomwareCount: number;
  [key: string]: unknown;
}

export interface WindowsDefenderDevice {
  deviceName?: string | null;
  amServiceEnabled: boolean;
  antiSpywareEnabled: boolean;
  behaviorMonitorEnabled: boolean;
  onAccessProtectionEnabled: boolean;
  realTimeProtectionEnabled: boolean;
  tamperProtectionStatus: boolean;
  [key: string]: unknown;
}

export interface ReportPageParams extends PageParams {}

// ---------------------------------------------------------------------
// Firewall - GET /windows/organisation/{organisationId}/reports/firewalls
// ---------------------------------------------------------------------

export interface Firewall {
  deviceName?: string | null;
  domainProfileFirewall?: boolean | null;
  enabled: boolean;
  privateProfileFirewall?: boolean | null;
  publicProfileFirewall?: boolean | null;
  firewallName?: string | null;
  firewallType?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Disks - GET .../device/{deviceId}/disks[/{diskId}/shares],
// GET .../reports/disks*
// ---------------------------------------------------------------------

export interface DeviceDiskEntry {
  deviceLetter: string;
  freeSpace: number;
  id: string;
  size: number;
  usedPercentage: number;
}

export interface Share {
  id: number;
  name?: string | null;
  path?: string | null;
  caption?: string | null;
  description?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface DiskDevice {
  deviceId?: string | null;
  diskId: number;
  diskPercentage: number;
  encryptionStatus?: string | null;
  fileSystem?: string | null;
  freeSpace?: number | null;
  machineName?: string | null;
  mountPoint?: string | null;
  shareCount: number;
  size?: number | null;
  [key: string]: unknown;
}

export interface DeviceDisk {
  deviceId?: string | null;
  diskIds: number[];
  hasAgent: boolean;
  hasUnencryptedDrive: boolean;
  machineName?: string | null;
  totalDiskCount: number;
  totalShareCount: number;
  [key: string]: unknown;
}

export interface DiskSummary {
  devicesLowDiskSpaceCount: number;
  devicesLowDiskSpaces: Array<Record<string, unknown>>;
  devicesUnencryptedCount: number;
  devicesWithSharesCount: number;
  sharedFoldersCount: number;
  totalDevices: number;
  unencryptedLaptops: Array<Record<string, unknown>>;
  unencryptedServers: Array<Record<string, unknown>>;
  usbDisksCount: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Hardware - GET /windows/organisation/{organisationId}/reports/hardware/*
// ---------------------------------------------------------------------

export interface HardwareReport {
  deviceId?: string | null;
  isEndOfLife: boolean;
  machineName?: string | null;
  memory?: string | null;
  organisationName?: string | null;
  osName?: string | null;
  processor?: string | null;
  serialNumber?: string | null;
  systemManufacturer?: string | null;
  systemModel?: string | null;
  user?: string | null;
  [key: string]: unknown;
}

export interface HardwareSummary {
  totalEolOs: number;
  totalMachines: number;
  totalServers: number;
  totalWorkstations: number;
}

// ---------------------------------------------------------------------
// Services - GET .../device/{deviceId}/services
// ---------------------------------------------------------------------

export interface WindowsService {
  caption: string;
  description: string;
  displayName: string;
  hasUnquotedServicePath: boolean;
  hostName: string;
  id: string;
  isSystemService: boolean;
  name: string;
  pathName: string;
  startMode: string;
  started: boolean;
  state: string;
  status: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Updates - GET .../device/{deviceId}/updates, GET .../reports/updates/*
// ---------------------------------------------------------------------

export interface UpdateFilterParams {
  critical?: boolean;
  security?: boolean;
  driver?: boolean;
  rollup?: boolean;
  other?: boolean;
}

export interface DeviceUpdatesReportDto {
  category: string;
  description: string;
  displayId: string;
  externalDeviceId: string;
  externalOrganisationId: string;
  id: string;
  isInstalled: boolean;
  isMandatory?: boolean | null;
  [key: string]: unknown;
}

export interface UpdatesByDeviceParams extends PageParams, SortParams, SearchParams, DaysFilterParams, UpdateFilterParams {
  workstations?: boolean;
  servers?: boolean;
  isRebootRequired?: boolean;
}

export interface UpdatesSummaryResponse {
  counts: Record<string, number>;
  devicesRequiringCriticalUpdates: Array<Record<string, unknown>>;
  devicesRequiringReboot: Array<Record<string, unknown>>;
  devicesRequiringSecurityUpdates: Array<Record<string, unknown>>;
  updatesPending: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Vulnerabilities - device + organisation reports
// ---------------------------------------------------------------------

export interface VulAppSummary {
  id: string;
  name: string;
  vendor: string;
  versions: number;
  devices: number;
  cves: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  cvss: number;
  upgradesAvailable: number;
  [key: string]: unknown;
}

export interface VulCveSummary {
  id: string;
  cvss: number;
  epss: number;
  epssPercentile: number;
  apps: number;
  devices: number;
  knownExploited: boolean;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  publishedDate?: string | null;
  modifiedDate?: string | null;
  [key: string]: unknown;
}

export interface VulDeviceSummary {
  id: string;
  name?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  cves: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  cvss: number;
  lastSeen?: number | null;
  user?: string | null;
  [key: string]: unknown;
}

export interface CveFix {
  fixId: string;
  description: string;
  availableVersion: string;
}

export interface VulnerabilitiesSummaryResponse {
  devicesCritical: number;
  devicesHigh: number;
  devicesMedium: number;
  devicesLow: number;
  totalCriticalApps: number;
  totalCriticalCves: number;
  totalCriticalDevices: number;
  totalHighCves?: number | null;
  totalMediumCves?: number | null;
  totalLowCves?: number | null;
  top5CriticalApps: VulAppSummary[];
  top5CriticalCves: VulCveSummary[];
  top5CriticalDevices: VulDeviceSummary[];
  mostCriticalServer?: VulDeviceSummary | null;
  mostCriticalWorkstation?: VulDeviceSummary | null;
  [key: string]: unknown;
}

export interface DeviceVulnerabilitySummaryResponse {
  applications: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------
// Remediation - GET .../reports/remediation-report[/{attemptId}/cves]
// ---------------------------------------------------------------------

export interface RemediationReport {
  action: string;
  category: string;
  completedAt?: number | null;
  createdAt: number;
  description: string;
  deviceName: string;
  executionId: string;
  hashedAttemptId: string;
  machineType: string;
  success?: boolean | null;
  suggestionIdentifier: string;
  [key: string]: unknown;
}

export interface RemediationReportParams extends PageParams, SearchParams, DaysFilterParams {}

export interface RemediationAttemptCves {
  cveIds: string[];
  details: Record<string, unknown>;
}
