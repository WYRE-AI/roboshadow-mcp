import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getAntivirusReportByDevice,
  getAntivirusSummary,
  getAntivirusThreats,
  getCredentials,
  getDeviceAntivirus,
  getRansomwareReport,
  getWindowsDefenderReport,
} from '../client.js';
import type { CallToolResult } from './types.js';
import {
  DEVICE_ID_PROPERTY,
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

export const ANTIVIRUS_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_device_antivirus',
    description:
      'Get antivirus/endpoint-protection state for one device: engine name, real-time/tamper-protection status, and any active threats.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY },
      required: ['organisationId', 'deviceId'],
    },
  },
  {
    name: 'roboshadow_get_antivirus_report_by_device',
    description: 'List antivirus/firewall/protection status for every device in the organisation.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_ransomware_report',
    description: 'List ransomware-protection status for every device in the organisation.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_antivirus_summary',
    description:
      'Get an organisation-wide antivirus summary: active-threat count, devices missing antivirus/on-access/real-time protection, third-party vs. Windows Defender coverage, and open-firewall count.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_antivirus_threats',
    description: 'List detected antivirus threats across the organisation, with severity and detection/remediation timing.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_windows_defender_report',
    description: 'List Windows Defender configuration status (real-time protection, tamper protection, service state) for every device.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(ANTIVIRUS_TOOLS.map((t) => t.name));
export function isAntivirusTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAntivirusTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;
    const pageParams = { page: args.page as number | undefined, itemsPerPage: args.itemsPerPage as number | undefined };

    if (name === 'roboshadow_get_device_antivirus') {
      return textResult(await getDeviceAntivirus(creds!, organisationId, args.deviceId as string));
    }

    if (name === 'roboshadow_get_antivirus_report_by_device') {
      return textResult(await getAntivirusReportByDevice(creds!, organisationId, pageParams));
    }

    if (name === 'roboshadow_get_ransomware_report') {
      return textResult(await getRansomwareReport(creds!, organisationId, pageParams));
    }

    if (name === 'roboshadow_get_antivirus_summary') {
      return textResult(await getAntivirusSummary(creds!, organisationId));
    }

    if (name === 'roboshadow_get_antivirus_threats') {
      return textResult(await getAntivirusThreats(creds!, organisationId, pageParams));
    }

    if (name === 'roboshadow_get_windows_defender_report') {
      return textResult(await getWindowsDefenderReport(creds!, organisationId, pageParams));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
