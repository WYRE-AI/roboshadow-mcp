import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getFirewallReport } from '../client.js';
import type { CallToolResult } from './types.js';
import { ORGANISATION_ID_PROPERTY, PAGE_PARAMS_PROPERTIES, errorResult, requireCredentials, textResult } from './shared.js';

export const FIREWALL_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_firewall_report',
    description:
      "List Windows firewall status (enabled/disabled per profile: domain, private, public) for every device in the organisation.",
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...PAGE_PARAMS_PROPERTIES },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(FIREWALL_TOOLS.map((t) => t.name));
export function isFirewallTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleFirewallTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'roboshadow_get_firewall_report') {
      return textResult(
        await getFirewallReport(creds!, args.organisationId as string, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
        })
      );
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
