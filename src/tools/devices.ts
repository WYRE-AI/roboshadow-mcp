import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getCredentials,
  getDevice,
  getDeviceUserProfiles,
  getDeviceUsers,
  listDevices,
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

// PII-bearing: Device carries an IP/MAC address, serial number and the
// currently logged-on user; DeviceUser/DeviceUserProfile carry SIDs, email
// addresses, and employee IDs. Admin-gated by default - see result-cache.ts's
// VENDOR_TOOL_CONFIG entry and tool-naming-exceptions.ts.
export const DEVICE_TOOLS: Tool[] = [
  {
    name: 'roboshadow_list_devices',
    description:
      'List every device in a RoboShadow organisation, with hardware/OS identity, network address, health scores, and pending-update/CVE counts. PII-bearing (IP/MAC address, logged-on user, serial number) - admin-gated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...SEARCH_PARAM_PROPERTY,
        ...SORT_PARAMS_PROPERTIES,
      },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_device',
    description: 'Get detailed information about a single device. PII-bearing - admin-gated.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY },
      required: ['organisationId', 'deviceId'],
    },
  },
  {
    name: 'roboshadow_get_device_user_profiles',
    description: 'List Windows user profiles present on one device, including profile SID and disk path. PII-bearing - admin-gated.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY },
      required: ['organisationId', 'deviceId'],
    },
  },
  {
    name: 'roboshadow_get_device_users',
    description:
      "List local/Active-Directory user accounts on one device, including email address, employee ID, and admin flag. PII-bearing - admin-gated.",
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DEVICE_ID_PROPERTY },
      required: ['organisationId', 'deviceId'],
    },
  },
];

const TOOL_NAMES = new Set(DEVICE_TOOLS.map((t) => t.name));
export function isDeviceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleDeviceTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;

    if (name === 'roboshadow_list_devices') {
      return textResult(
        await listDevices(creds!, organisationId, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          search: args.search as string | undefined,
          sortBy: args.sortBy as string | undefined,
          sortDesc: args.sortDesc as boolean | undefined,
        })
      );
    }

    if (name === 'roboshadow_get_device') {
      return textResult(await getDevice(creds!, organisationId, args.deviceId as string));
    }

    if (name === 'roboshadow_get_device_user_profiles') {
      return textResult(await getDeviceUserProfiles(creds!, organisationId, args.deviceId as string));
    }

    if (name === 'roboshadow_get_device_users') {
      return textResult(await getDeviceUsers(creds!, organisationId, args.deviceId as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
