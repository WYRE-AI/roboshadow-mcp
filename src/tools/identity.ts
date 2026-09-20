import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listOrganisations, listOrganisationUsers } from '../client.js';
import type { CallToolResult } from './types.js';
import { ORGANISATION_ID_PROPERTY, errorResult, requireCredentials, textResult } from './shared.js';

export const IDENTITY_TOOLS: Tool[] = [
  {
    name: 'roboshadow_list_organisations',
    description:
      "List every RoboShadow organisation visible to this connector's refresh token, with each organisation's ID, name, and the caller's permission level. Start here to discover the organisationId every other tool needs.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'roboshadow_list_organisation_users',
    description:
      "List the users belonging to a RoboShadow organisation, with each user's display name, email, and permission level. PII-bearing - admin-gated.",
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(IDENTITY_TOOLS.map((t) => t.name));
export function isIdentityTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleIdentityTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'roboshadow_list_organisations') {
      return textResult(await listOrganisations(creds!));
    }

    if (name === 'roboshadow_list_organisation_users') {
      return textResult(await listOrganisationUsers(creds!, args.organisationId as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
