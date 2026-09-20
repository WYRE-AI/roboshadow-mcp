import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getCpeVulnerabilities,
  getCredentials,
  getCveFixes,
  getCveVulnerabilities,
  getDeviceVulnerabilitySummary,
  getVulnerabilitiesSummary,
  getVulnerableApplications,
  getVulnerableDevices,
} from '../client.js';
import type { CallToolResult } from './types.js';
import {
  DAYS_FILTER_PROPERTY,
  DEVICE_ID_PROPERTY,
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

const CVE_ID_PROPERTY = {
  cveId: { type: 'string', description: 'CVE identifier (e.g. CVE-2024-1234).' },
} as const;

export const VULNERABILITY_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_device_vulnerability_summary',
    description:
      'Get the vulnerability summary for one device: per-application CVE lists (with CVSS scores and available WinGet upgrades) and an overall severity rollup.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY },
      required: ['organisationId', 'deviceId'],
    },
  },
  {
    name: 'roboshadow_get_vulnerable_applications',
    description: 'List applications with known vulnerabilities across the organisation, with per-severity CVE counts and available upgrades.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES, ...DAYS_FILTER_PROPERTY },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_cpe_vulnerabilities',
    description: 'List CPE (Common Platform Enumeration) vulnerability findings across the organisation.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_cve_vulnerabilities',
    description:
      'List CVEs affecting the organisation, each with CVSS/EPSS score, known-exploited-in-the-wild flag, and affected-OS/app/device counts.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES, ...DAYS_FILTER_PROPERTY },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_cve_fixes',
    description: 'List available fixes/patches for one CVE.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...CVE_ID_PROPERTY },
      required: ['organisationId', 'cveId'],
    },
  },
  {
    name: 'roboshadow_get_vulnerable_devices',
    description: 'List devices with known vulnerabilities, each with per-severity CVE counts and an overall CVSS score.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES, ...DAYS_FILTER_PROPERTY },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_vulnerabilities_summary',
    description:
      'Get an organisation-wide vulnerability summary: devices by severity, top-5 most critical apps/CVEs/devices, and the single most critical server/workstation.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DAYS_FILTER_PROPERTY },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(VULNERABILITY_TOOLS.map((t) => t.name));
export function isVulnerabilityTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleVulnerabilityTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;
    const pageParams = { page: args.page as number | undefined, itemsPerPage: args.itemsPerPage as number | undefined };

    if (name === 'roboshadow_get_device_vulnerability_summary') {
      return textResult(await getDeviceVulnerabilitySummary(creds!, organisationId, args.deviceId as string));
    }

    if (name === 'roboshadow_get_vulnerable_applications') {
      return textResult(
        await getVulnerableApplications(creds!, organisationId, { ...pageParams, days: args.days as number | undefined })
      );
    }

    if (name === 'roboshadow_get_cpe_vulnerabilities') {
      return textResult(await getCpeVulnerabilities(creds!, organisationId, pageParams));
    }

    if (name === 'roboshadow_get_cve_vulnerabilities') {
      return textResult(
        await getCveVulnerabilities(creds!, organisationId, { ...pageParams, days: args.days as number | undefined })
      );
    }

    if (name === 'roboshadow_get_cve_fixes') {
      return textResult(await getCveFixes(creds!, organisationId, args.cveId as string));
    }

    if (name === 'roboshadow_get_vulnerable_devices') {
      return textResult(
        await getVulnerableDevices(creds!, organisationId, { ...pageParams, days: args.days as number | undefined })
      );
    }

    if (name === 'roboshadow_get_vulnerabilities_summary') {
      return textResult(await getVulnerabilitiesSummary(creds!, organisationId, { days: args.days as number | undefined }));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
