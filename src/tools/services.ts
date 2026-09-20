import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getDeviceServices } from '../client.js';
import type { CallToolResult } from './types.js';
import {
  DEVICE_ID_PROPERTY,
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  SEARCH_PARAM_PROPERTY,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

export const SERVICE_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_device_services',
    description:
      'List Windows services on one device, including start mode, running state, and whether the service has an unquoted-path vulnerability.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...DEVICE_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...SEARCH_PARAM_PROPERTY,
      },
      required: ['organisationId', 'deviceId'],
    },
  },
];

const TOOL_NAMES = new Set(SERVICE_TOOLS.map((t) => t.name));
export function isServiceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleServiceTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'roboshadow_get_device_services') {
      return textResult(
        await getDeviceServices(creds!, args.organisationId as string, args.deviceId as string, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          search: args.search as string | undefined,
        })
      );
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
