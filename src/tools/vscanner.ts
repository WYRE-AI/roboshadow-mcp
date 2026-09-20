import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getScanIpsOverview, getScanSummary, listScanStatus } from '../client.js';
import type { CallToolResult } from './types.js';
import {
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  SORT_PARAMS_PROPERTIES,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

const SCAN_ID_PROPERTY = {
  scanId: { type: 'string', description: 'Unique identifier for the vulnerability scan.' },
} as const;

export const VSCANNER_TOOLS: Tool[] = [
  {
    name: 'roboshadow_list_scan_status',
    description:
      'List the status of every external vulnerability scan (VScanner) for an organisation, with per-IP and per-domain scan status. Filter by isScheduled or status.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...SORT_PARAMS_PROPERTIES,
        isScheduled: { type: 'boolean', description: 'Filter to scans that were (or were not) started by a schedule.' },
        status: { type: 'string', description: 'Filter scans by overall status.' },
      },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_scan_summary',
    description:
      'Get a detailed summary of one external vulnerability scan: scan details, IP vulnerability totals, and web vulnerability findings.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...SCAN_ID_PROPERTY },
      required: ['organisationId', 'scanId'],
    },
  },
  {
    name: 'roboshadow_get_scan_ips_overview',
    description:
      'Get a per-target breakdown of one external vulnerability scan: CVE counts by severity, open-port counts, and component scan statuses for each scanned IP.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...SCAN_ID_PROPERTY },
      required: ['organisationId', 'scanId'],
    },
  },
];

const TOOL_NAMES = new Set(VSCANNER_TOOLS.map((t) => t.name));
export function isVscannerTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleVscannerTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;

    if (name === 'roboshadow_list_scan_status') {
      return textResult(
        await listScanStatus(creds!, organisationId, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          sortBy: args.sortBy as string | undefined,
          sortDesc: args.sortDesc as boolean | undefined,
          isScheduled: args.isScheduled as boolean | undefined,
          status: args.status as string | undefined,
        })
      );
    }

    if (name === 'roboshadow_get_scan_summary') {
      return textResult(await getScanSummary(creds!, organisationId, args.scanId as string));
    }

    if (name === 'roboshadow_get_scan_ips_overview') {
      return textResult(await getScanIpsOverview(creds!, organisationId, args.scanId as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
