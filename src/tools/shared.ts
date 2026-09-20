import type { RoboShadowCredentials } from '../types.js';
import type { CallToolResult } from './types.js';

export function textResult(value: unknown): CallToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

/** Returns an error CallToolResult if credentials are missing, else null. */
export function requireCredentials(creds: RoboShadowCredentials | null): CallToolResult | null {
  if (!creds) {
    return errorResult('No RoboShadow credentials configured. Set ROBOSHADOW_REFRESH_TOKEN.');
  }
  return null;
}

/** Every tool in this connector is scoped to one organisation, per RoboShadow's own API shape. */
export const ORGANISATION_ID_PROPERTY = {
  organisationId: {
    type: 'string',
    description: "The RoboShadow organisation's UUID. Discover it with roboshadow_list_organisations.",
  },
} as const;

/** Shared input-schema fragment for the page/itemsPerPage-paginated report endpoints. */
export const PAGE_PARAMS_PROPERTIES = {
  page: { type: 'number', description: 'Page number for pagination (1-indexed). Default 1.' },
  itemsPerPage: { type: 'number', description: 'Number of items per page (1-100). Default 10.' },
} as const;

/** Shared input-schema fragment for the sortBy/sortDesc-sortable report endpoints. */
export const SORT_PARAMS_PROPERTIES = {
  sortBy: { type: 'string', description: 'Field name to sort by.' },
  sortDesc: { type: 'boolean', description: 'Sort in descending order. Default false.' },
} as const;

/** Shared input-schema fragment for the search-filterable report endpoints. */
export const SEARCH_PARAM_PROPERTY = {
  search: { type: 'string', description: 'Search term for filtering results.' },
} as const;

/** Shared input-schema fragment for the days-filterable report endpoints. */
export const DAYS_FILTER_PROPERTY = {
  days: { type: 'number', description: 'Filter results to the last N days.' },
} as const;

/** Every device-scoped tool takes the device's external identifier. */
export const DEVICE_ID_PROPERTY = {
  deviceId: { type: 'string', description: 'Unique identifier for the device.' },
} as const;
