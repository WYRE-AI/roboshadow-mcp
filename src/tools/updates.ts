import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getDeviceUpdates, getUpdatesReportByDevice, getUpdatesSummary } from '../client.js';
import type { CallToolResult } from './types.js';
import {
  DAYS_FILTER_PROPERTY,
  DEVICE_ID_PROPERTY,
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  SEARCH_PARAM_PROPERTY,
  SORT_PARAMS_PROPERTIES,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

/** The five update-category boolean filters shared by every "by device" updates endpoint. */
const UPDATE_CATEGORY_FILTER_PROPERTIES = {
  critical: { type: 'boolean', description: 'Filter to critical updates.' },
  security: { type: 'boolean', description: 'Filter to security updates.' },
  driver: { type: 'boolean', description: 'Filter to driver updates.' },
  rollup: { type: 'boolean', description: 'Filter to rollup updates.' },
  other: { type: 'boolean', description: 'Filter to other updates.' },
} as const;

function updateCategoryFilterArgs(args: Record<string, unknown>) {
  return {
    critical: args.critical as boolean | undefined,
    security: args.security as boolean | undefined,
    driver: args.driver as boolean | undefined,
    rollup: args.rollup as boolean | undefined,
    other: args.other as boolean | undefined,
  };
}

export const UPDATE_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_device_updates',
    description: 'List missing Windows updates for one device, with category, KB/package ID, and reboot requirement.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...DEVICE_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...UPDATE_CATEGORY_FILTER_PROPERTIES,
      },
      required: ['organisationId', 'deviceId'],
    },
  },
  {
    name: 'roboshadow_get_updates_report_by_device',
    description:
      'List a paginated missing-updates report grouped by device across the organisation, filterable by update category, workstation/server, and reboot-required status.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...SORT_PARAMS_PROPERTIES,
        ...SEARCH_PARAM_PROPERTY,
        ...DAYS_FILTER_PROPERTY,
        ...UPDATE_CATEGORY_FILTER_PROPERTIES,
        workstations: { type: 'boolean', description: 'Filter to workstation devices.' },
        servers: { type: 'boolean', description: 'Filter to server devices.' },
        isRebootRequired: { type: 'boolean', description: 'Filter to devices requiring reboot.' },
      },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_updates_summary',
    description:
      'Get organisation-wide update summary statistics (devices needing critical/security/driver/rollup updates, reboot-pending count) plus the top devices requiring attention.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...DAYS_FILTER_PROPERTY },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(UPDATE_TOOLS.map((t) => t.name));
export function isUpdateTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleUpdateTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;

    if (name === 'roboshadow_get_device_updates') {
      return textResult(
        await getDeviceUpdates(creds!, organisationId, args.deviceId as string, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          ...updateCategoryFilterArgs(args),
        })
      );
    }

    if (name === 'roboshadow_get_updates_report_by_device') {
      return textResult(
        await getUpdatesReportByDevice(creds!, organisationId, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          sortBy: args.sortBy as string | undefined,
          sortDesc: args.sortDesc as boolean | undefined,
          search: args.search as string | undefined,
          days: args.days as number | undefined,
          workstations: args.workstations as boolean | undefined,
          servers: args.servers as boolean | undefined,
          isRebootRequired: args.isRebootRequired as boolean | undefined,
          ...updateCategoryFilterArgs(args),
        })
      );
    }

    if (name === 'roboshadow_get_updates_summary') {
      return textResult(await getUpdatesSummary(creds!, organisationId, { days: args.days as number | undefined }));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
