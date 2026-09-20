import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getApplicationGroup,
  getCredentials,
  getDeviceApplications,
  listApplicationGroups,
} from '../client.js';
import type { CallToolResult } from './types.js';
import {
  DEVICE_ID_PROPERTY,
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  SEARCH_PARAM_PROPERTY,
  SORT_PARAMS_PROPERTIES,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

export const APPLICATION_TOOLS: Tool[] = [
  {
    name: 'roboshadow_list_application_groups',
    description:
      'List applications grouped across the organisation (by application identity, not per-install), each with install/device counts, distinct version counts, and a best-matching WinGet package if one exists.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...SORT_PARAMS_PROPERTIES,
        ...SEARCH_PARAM_PROPERTY,
      },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_application_group',
    description: 'Get detailed information for one application group by its hashed group ID.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        group_id: { type: 'string', description: 'Hashed application group ID.' },
      },
      required: ['organisationId', 'group_id'],
    },
  },
  {
    name: 'roboshadow_get_device_applications',
    description: 'List applications installed on one device, with vendor, version, and last-seen time.',
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

const TOOL_NAMES = new Set(APPLICATION_TOOLS.map((t) => t.name));
export function isApplicationTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleApplicationTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;

    if (name === 'roboshadow_list_application_groups') {
      return textResult(
        await listApplicationGroups(creds!, organisationId, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          sortBy: args.sortBy as string | undefined,
          sortDesc: args.sortDesc as boolean | undefined,
          search: args.search as string | undefined,
        })
      );
    }

    if (name === 'roboshadow_get_application_group') {
      return textResult(await getApplicationGroup(creds!, organisationId, args.group_id as string));
    }

    if (name === 'roboshadow_get_device_applications') {
      return textResult(
        await getDeviceApplications(creds!, organisationId, args.deviceId as string, {
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
