# RoboShadow MCP Server

MCP server for [RoboShadow](https://www.roboshadow.com/)'s **Rubicon Platform Data API** - endpoint security (antivirus, Windows Defender, firewall), asset/hardware inventory, applications, users, vulnerabilities, and remediation status, for AI assistants and the WYRE Conduit gateway.

## Scope: every documented operation is read-only (deliberate, not a filtered subset)

RoboShadow's Rubicon Platform Data API (`https://cdn.development.roboshadow.com/publicapi/openapi.yaml`, fetched directly) defines **40 GET paths across 15 tags** (Antivirus, Applications, Defender, Devices, Disks, Firewall, Hardware, Identity, MFA, Remediation, Services, Updates, Users, Vulnerabilities, Vulnerability Scanner) and exactly **one** non-GET operation in the entire spec: `POST /identity/bearertoken`. That single POST is the vendor's own documented credential-refresh mechanism (OpenAPI tag: Authentication) - it exchanges a Refresh Token for a short-lived Bearer Token and mutates no organisation data. There is no create/update/delete/remediation-trigger endpoint anywhere in the published spec to exclude - unlike this session's other connectors, this one has no write surface to carve away from.

**This connector implements all 40 GET operations, one tool each, and calls `POST /identity/bearertoken` internally (never as an exposed tool) purely to keep its own access token fresh.** See Authentication below for why that call exists and why it isn't a tool.

## Authentication

RoboShadow's Rubicon Platform Data API authenticates with a **Bearer token** (`components.securitySchemes.BearerAuth`, `bearerFormat: JWT` in the vendor's own spec). Generate credentials at your RoboShadow portal under **Reports -> API Token**, which shows three values together: an **Organisation ID**, a **Bearer Token**, and a **Refresh Token**.

The Bearer Token itself is short-lived - RoboShadow's own `BearerTokenResponse` schema documents `expiresIn` in seconds (~1 hour in the vendor's example). A token pasted into a long-running connector would go stale within the hour, so **this connector stores the Refresh Token instead** and exchanges it for a fresh Bearer Token internally (`POST /identity/bearertoken`) before every data call, caching the result in-process until shortly before it expires. The Organisation ID is not stored as a credential - pass it as the `organisationId` argument to any tool (discover it with `roboshadow_list_organisations` if you don't already have it), since a Refresh Token can resolve to more than one organisation on an MSP/reseller account.

Two separate claims here, at deliberately different confidence levels - the two-tier split established across this batch of connectors:

- **Structurally verified (checked directly, stated with full confidence):** this connector's own code makes zero mutating calls against RoboShadow's data API. Every function in `client.ts` that reads organisation data calls one of the 40 dedicated GET operations in the published spec; the only non-GET call anywhere in `src/` is the bearer-token exchange itself, and it is never exposed as an MCP tool.
- **Vendor-documented, not independently verified (hedged deliberately):** RoboShadow's own OpenAPI spec defines no write/mutate endpoint for organisation data anywhere - there is no scoped, read-only variant of the Bearer/Refresh Token to request instead, because the full token grants exactly the same access the vendor's own spec grants: reads only. Whether some other, undocumented part of the RoboShadow platform (outside this Organisation-Endpoints spec) accepts write calls under the same token has not been tested by WYRE - only that this spec, and this connector, expose none.

In gateway mode the refresh token arrives per-request via the `X-RoboShadow-Refresh-Token` header; in local/stdio mode it's read once from `ROBOSHADOW_REFRESH_TOKEN`.

## Configuration

| Env var | Description |
|---|---|
| `ROBOSHADOW_REFRESH_TOKEN` | RoboShadow Refresh Token (Reports -> API Token in the portal). |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the var above) or `gateway` (credential arrives per-request via the `X-RoboShadow-Refresh-Token` header, injected by the Conduit gateway). |
| `CONDUIT_S2S_SECRET` | When set, the HTTP transport requires a valid `X-Gateway-S2S` header (Conduit sidecar auth) on every `/mcp` request. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

## Tools

40 read-only tools, one per GET operation in the Rubicon Platform Data API's published spec. Every tool that reads organisation-scoped data takes `organisationId` - discover it with `roboshadow_list_organisations`.

### Identity
- `roboshadow_list_organisations` - list every organisation visible to this refresh token.
- `roboshadow_list_organisation_users` - list an organisation's users (display name, email, permission level). **PII - admin-gated.**

### MFA
- `roboshadow_get_mfa_report` - paged MFA status report (registered methods, MFA status, Global Administrator flag) for a Microsoft-identity-linked organisation. **PII/identity data - admin-gated.**

### Vulnerability Scanner
- `roboshadow_list_scan_status` - status of every external vulnerability scan (VScanner), filterable by schedule/status.
- `roboshadow_get_scan_summary` - detailed summary of one scan (IP + web vulnerability totals).
- `roboshadow_get_scan_ips_overview` - per-target CVE/port breakdown for one scan.

### Applications
- `roboshadow_list_application_groups` - applications grouped across the organisation, with install/device/version counts.
- `roboshadow_get_application_group` - detail for one application group.
- `roboshadow_get_device_applications` - applications installed on one device.

### Devices
- `roboshadow_list_devices` - every device in the organisation, with hardware/OS identity, network address, health scores, and CVE/update counts. **PII (IP/MAC address, logged-on user, serial number) - admin-gated.**
- `roboshadow_get_device` - detail for one device. **PII - admin-gated.**
- `roboshadow_get_device_user_profiles` - Windows user profiles on one device (includes SID). **PII - admin-gated.**
- `roboshadow_get_device_users` - local/AD users on one device (email, employee ID, admin flag). **PII - admin-gated.**

### Antivirus / Defender
- `roboshadow_get_device_antivirus` - antivirus/endpoint-protection state for one device.
- `roboshadow_get_antivirus_report_by_device` - antivirus status for every device.
- `roboshadow_get_ransomware_report` - ransomware-protection status for every device.
- `roboshadow_get_antivirus_summary` - organisation-wide antivirus summary.
- `roboshadow_get_antivirus_threats` - detected antivirus threats across the organisation.
- `roboshadow_get_windows_defender_report` - Windows Defender configuration status for every device.

### Firewall
- `roboshadow_get_firewall_report` - Windows firewall status (per profile) for every device.

### Disks
- `roboshadow_get_device_disks` - disks on one device.
- `roboshadow_get_disk_shares` - network shares exposed on one disk.
- `roboshadow_get_disk_report` - disk usage across the organisation, grouped by disk.
- `roboshadow_get_disk_report_by_device` - disk information grouped by device.
- `roboshadow_get_disk_summary` - organisation-wide disk-usage summary (low-space devices, unencrypted drives, shares, USB disks).

### Hardware
- `roboshadow_get_hardware_report_by_device` - hardware inventory grouped by device.
- `roboshadow_get_hardware_summary` - organisation-wide hardware summary.

### Services
- `roboshadow_get_device_services` - Windows services on one device, including unquoted-service-path vulnerability flag.

### Updates
- `roboshadow_get_device_updates` - missing Windows updates for one device.
- `roboshadow_get_updates_report_by_device` - paginated missing-updates report grouped by device.
- `roboshadow_get_updates_summary` - organisation-wide update summary and top devices needing attention.

### Vulnerabilities
- `roboshadow_get_device_vulnerability_summary` - per-application CVE detail and severity rollup for one device.
- `roboshadow_get_vulnerable_applications` - applications with known vulnerabilities across the organisation.
- `roboshadow_get_cpe_vulnerabilities` - CPE vulnerability findings across the organisation.
- `roboshadow_get_cve_vulnerabilities` - CVEs affecting the organisation (CVSS/EPSS, known-exploited flag).
- `roboshadow_get_cve_fixes` - available fixes/patches for one CVE.
- `roboshadow_get_vulnerable_devices` - devices with known vulnerabilities.
- `roboshadow_get_vulnerabilities_summary` - organisation-wide vulnerability summary and top-5 critical apps/CVEs/devices.

### Remediation
- `roboshadow_get_remediation_report` - vulnerability-remediation attempts across the organisation (action, target, outcome).
- `roboshadow_get_remediation_attempt_cves` - CVEs addressed by one remediation attempt.

## Sensitivity

RoboShadow is an endpoint-security and vulnerability-management platform - even as plain reads, most of this connector's 40 tools surface data that is PII (device users' SIDs, employee IDs, and email addresses; a device's logged-on user, IP/MAC address, and serial number), identity/MFA posture, or security-assessment data (vulnerabilities, threats, remediation outcomes, external scan results). Per this session's convention for vendors of this class (the same posture as Cork, CyberQP, Cisco Duo, and Slide in this same wave), **every tool in this connector is `isAdmin: true` in the Conduit wiring, regardless of verb** - this is a deliberate, vendor-wide design decision documented once in `vendor-config.ts`'s `roboshadow` entry, not a per-tool sensitive-read escalation.

## Development

```bash
npm install
npm run build
npm test
npm run lint   # tsc --noEmit
```

## Docker

```bash
docker build -t roboshadow-mcp .
docker run -p 8080:8080 -e ROBOSHADOW_REFRESH_TOKEN=... roboshadow-mcp
```

## License

Apache-2.0
