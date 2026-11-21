export const SEVERITIES = ["all", "info", "warning", "critical"] as const;
export type SeverityFilter = (typeof SEVERITIES)[number];

// Never trust the URL: an unknown value falls back to "all"
export function parseSeverity(value: string | null | undefined): SeverityFilter {
  return SEVERITIES.includes(value as SeverityFilter) ? (value as SeverityFilter) : "all";
}

// Identifies a filter configuration (used to know which data we already hold)
export function filtersKey(search: string, severity: SeverityFilter) {
  return JSON.stringify([search, severity]);
}