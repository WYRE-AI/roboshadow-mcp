import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getRemediationAttemptCves, getRemediationReport } from '../client.js';
import type { CallToolResult } from './types.js';
import {
  DAYS_FILTER_PROPERTY,
  ORGANISATION_ID_PROPERTY,
  PAGE_PARAMS_PROPERTIES,
  SEARCH_PARAM_PROPERTY,
  errorResult,
  requireCredentials,
  textResult,
} from './shared.js';

const ATTEMPT_ID_PROPERTY = {
  attemptId: { type: 'string', description: 'Hashed remediation attempt identifier.' },
} as const;

export const REMEDIATION_TOOLS: Tool[] = [
  {
    name: 'roboshadow_get_remediation_report',
    description:
      'List detailed vulnerability-remediation attempts across the organisation: action taken, category, target device, and success/failure outcome.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ORGANISATION_ID_PROPERTY,
        ...PAGE_PARAMS_PROPERTIES,
        ...SEARCH_PARAM_PROPERTY,
        ...DAYS_FILTER_PROPERTY,
      },
      required: ['organisationId'],
    },
  },
  {
    name: 'roboshadow_get_remediation_attempt_cves',
    description: 'List the CVEs addressed by one remediation attempt.',
    inputSchema: {
      type: 'object',
      properties: { ...ORGANISATION_ID_PROPERTY, ...ATTEMPT_ID_PROPERTY },
      required: ['organisationId', 'attemptId'],
    },
  },
];

const TOOL_NAMES = new Set(REMEDIATION_TOOLS.map((t) => t.name));
export function isRemediationTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleRemediationTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    const organisationId = args.organisationId as string;

    if (name === 'roboshadow_get_remediation_report') {
      return textResult(
        await getRemediationReport(creds!, organisationId, {
          page: args.page as number | undefined,
          itemsPerPage: args.itemsPerPage as number | undefined,
          search: args.search as string | undefined,
          days: args.days as number | undefined,
        })
      );
    }

    if (name === 'roboshadow_get_remediation_attempt_cves') {
      return textResult(await getRemediationAttemptCves(creds!, organisationId, args.attemptId as string));
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
