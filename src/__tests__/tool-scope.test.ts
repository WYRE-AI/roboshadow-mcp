import { describe, expect, it } from 'vitest';
import { ALL_TOOLS } from '../tools/index.js';

/**
 * Hard scope boundary (see README's Scope section): RoboShadow's Rubicon
 * Platform Data API defines no write/create/update/delete operation
 * anywhere in its spec - every path is GET except the vendor's own bearer-
 * token exchange (an auth mechanism, not a data mutation, and not exposed
 * as a tool). This test pins the exact tool set anyway, so a copy-pasted
 * or hallucinated tool from a future edit fails immediately rather than
 * silently shipping - the same discipline the other read-only-by-design
 * connectors in this org apply (see cork-mcp's tool-scope.test.ts).
 */
describe('ALL_TOOLS scope boundary', () => {
  const EXPECTED_TOOL_NAMES = [
    // Identity
    'roboshadow_list_organisations',
    'roboshadow_list_organisation_users',
    // MFA
    'roboshadow_get_mfa_report',
    // Vulnerability Scanner
    'roboshadow_list_scan_status',
    'roboshadow_get_scan_summary',
    'roboshadow_get_scan_ips_overview',
    // Applications
    'roboshadow_list_application_groups',
    'roboshadow_get_application_group',
    'roboshadow_get_device_applications',
    // Devices
    'roboshadow_list_devices',
    'roboshadow_get_device',
    'roboshadow_get_device_user_profiles',
    'roboshadow_get_device_users',
    // Antivirus / Defender
    'roboshadow_get_device_antivirus',
    'roboshadow_get_antivirus_report_by_device',
    'roboshadow_get_ransomware_report',
    'roboshadow_get_antivirus_summary',
    'roboshadow_get_antivirus_threats',
    'roboshadow_get_windows_defender_report',
    // Firewall
    'roboshadow_get_firewall_report',
    // Disks
    'roboshadow_get_device_disks',
    'roboshadow_get_disk_shares',
    'roboshadow_get_disk_report',
    'roboshadow_get_disk_report_by_device',
    'roboshadow_get_disk_summary',
    // Hardware
    'roboshadow_get_hardware_report_by_device',
    'roboshadow_get_hardware_summary',
    // Services
    'roboshadow_get_device_services',
    // Updates
    'roboshadow_get_device_updates',
    'roboshadow_get_updates_report_by_device',
    'roboshadow_get_updates_summary',
    // Vulnerabilities
    'roboshadow_get_device_vulnerability_summary',
    'roboshadow_get_vulnerable_applications',
    'roboshadow_get_cpe_vulnerabilities',
    'roboshadow_get_cve_vulnerabilities',
    'roboshadow_get_cve_fixes',
    'roboshadow_get_vulnerable_devices',
    'roboshadow_get_vulnerabilities_summary',
    // Remediation
    'roboshadow_get_remediation_report',
    'roboshadow_get_remediation_attempt_cves',
  ].sort();

  it("exposes exactly this connector's 40 read-only tools - nothing more, nothing less", () => {
    const names = ALL_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
    expect(names).toHaveLength(40);
  });

  it('never exposes a write, delete, create, update, or credential-minting tool', () => {
    // Forbidden as a whole underscore-token, not a substring, so this does
    // NOT false-positive on tokens like 'updates' (a report NOUN) vs
    // 'update' (the mutation verb), or 'reports' vs a hypothetical 'report'
    // write verb.
    const FORBIDDEN_TOKENS = new Set([
      'create', 'update', 'delete', 'add', 'set', 'edit', 'remove', 'resolve',
      'disable', 'enable', 'reset', 'revoke', 'install', 'uninstall',
      'remediate', 'patch', 'apply', 'run', 'trigger', 'quarantine',
      'bearertoken', 'refresh',
    ]);

    for (const tool of ALL_TOOLS) {
      const tokens = tool.name.split('_');
      for (const token of tokens) {
        expect(
          FORBIDDEN_TOKENS.has(token),
          `Tool "${tool.name}" contains forbidden token "${token}" - this connector must stay strictly read-only.`
        ).toBe(false);
      }
    }
  });

  it('every tool name is prefixed with roboshadow_', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name.startsWith('roboshadow_')).toBe(true);
    }
  });

  it('every tool declares a non-empty description and an object inputSchema', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description, `Tool "${tool.name}" is missing a description`).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});
