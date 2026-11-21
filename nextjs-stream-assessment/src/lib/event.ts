import { ALL_EVENTS, type SystemEvent } from "@/lib/mockData";
import type { SeverityFilter } from "./filter";

// Server-only: never import this from a Client Component
export function filterEvents(rawSearch: string, severity: SeverityFilter): SystemEvent[] {
  const search = rawSearch.toLowerCase().trim();
  return ALL_EVENTS.filter((evt) => {
    const matchesSeverity = severity === "all" || evt.severity === severity;
    const matchesSearch =
      !search ||
      evt.title.toLowerCase().includes(search) ||
      evt.service.toLowerCase().includes(search) ||
      evt.id.toLowerCase().includes(search);
    return matchesSeverity && matchesSearch;
  });
}