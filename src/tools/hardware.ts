import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getHardwareReportByDevice, getHardwareSummary } from '../client.js';
import type { CallToolResult } from './types.js';
import { ORGANISATION_ID_PROPERTY, PAGE_PARAMS_PROPERTIES, errorResult, requireCredentials, textResult } from './shared.js';

export const HARDWARE_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_hardware_report_by_device',
    description:
      'List hardware inventory grouped by device: processor, memory, serial number, system manufacturer/model, and end-of-life OS flag.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_hardware_summary',
    description: 'Get an organisation-wide hardware summary: total machines, servers, workstations, and machines running an end-of-life OS.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(HARDWARE_TOOLS.map((t) => t.name));
export function isHardwareTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleHardwareTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;

    if (name === 'roboshadow_get_hardware_report_by_device') {
      return textResult(
        await getHardwareReportByDevice(creds!, organisationId, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
        })
      );
    }

    if (name === 'roboshadow_get_hardware_summary') {
      return textResult(await getHardwareSummary(creds!, organisationId));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
