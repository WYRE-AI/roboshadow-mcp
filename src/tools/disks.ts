import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getCredentials,
  getDeviceDisks,
  getDiskReport,
  getDiskReportByDevice,
  getDiskShares,
  getDiskSummary,
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

const DISK_ID_PROPERTY = {
  diskId: { type: 'string', description: 'Disk identifier.' },
} as const;

export const DISK_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_device_disks',
    description: 'List disks (drive letter, size, free space, used %) on one device.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY },
      required: ['organisationId', 'deviceId'],
    },
  },
  {
    name: 'roboshadow_get_disk_shares',
    description: 'List network shares exposed on one disk of one device. Includes share path and access details.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY, ...DISK_ID_PROPERTY },
      required: ['organisationId', 'deviceId', 'diskId'],
    },
  },
  {
    name: 'roboshadow_get_disk_report',
    description: 'List disk usage across the organisation, grouped by disk (percentage used, encryption status, share count).',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_disk_report_by_device',
    description: 'List disk information grouped by device (total disk/share counts, whether any drive is unencrypted).',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_disk_summary',
    description:
      'Get an organisation-wide disk-usage summary: low-disk-space devices, unencrypted laptops/servers/workstations, shared-folder and USB-disk counts.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(DISK_TOOLS.map((t) => t.name));
export function isDiskTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleDiskTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;
    const pageParams = { page: args.page as number | undefined, itemsPerPage: args.itemsPerPage as number | undefined };

    if (name === 'roboshadow_get_device_disks') {
      return textResult(await getDeviceDisks(creds!, organisationId, args.deviceId as string));
    }

    if (name === 'roboshadow_get_disk_shares') {
      return textResult(await getDiskShares(creds!, organisationId, args.deviceId as string, args.diskId as string));
    }

    if (name === 'roboshadow_get_disk_report') {
      return textResult(await getDiskReport(creds!, organisationId, pageParams));
    }

    if (name === 'roboshadow_get_disk_report_by_device') {
      return textResult(await getDiskReportByDevice(creds!, organisationId, pageParams));
    }

    if (name === 'roboshadow_get_disk_summary') {
      return textResult(await getDiskSummary(creds!, organisationId));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
