import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getMfaReport } from '../client.js';
import type { CallToolResult } from './types.js';
import { ORGANISATION_ID_PROPERTY, errorResult, requireCredentials, textResult } from './shared.js';

export const MFA_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_mfa_report',
    description:
      "Get a paged multi-factor-authentication report for a Microsoft-identity-linked organisation: each user's registered MFA methods, MFA status, and whether they hold the Global Administrator role. Results page in blocks of 5000 users - pass skipPages to page through until hasMoreData is false. PII-bearing identity data - admin-gated.",
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        skipPages: { type: 'number', description: 'Zero-based page number to skip to (page size is 5000). Default 0.' },
      },
      required: ['organisationId'],
    },
  },
];

const TOOL_NAMES = new Set(MFA_TOOLS.map((t) => t.name));
export function isMfaTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleMfaTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'roboshadow_get_mfa_report') {
      return textResult(
        await getMfaReport(creds!, {
          organisationId: args.organisationId as string,
          skipPages: args.skipPages as number | undefined,
        })
      );
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
