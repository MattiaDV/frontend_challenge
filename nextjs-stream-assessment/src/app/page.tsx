import { Suspense } from "react";
import { Dashboard } from "../components/Dashboard";
import { filterEvents } from "@/lib/event";
import { parseSeverity } from "@/lib/filter";

type PageProps = {
  // Next 15: searchParams is a Promise
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialSearch = first(sp.search) ?? "";
  const initialSeverity = parseSeverity(first(sp.severity));

  // Initial load happens on the server: no client round-trip, no loading flash
  const initialEvents = filterEvents(initialSearch, initialSeverity);

  return (
    <Suspense fallback={<div style={{ padding: 16, color: "#94a3b8" }}>Loading dashboard...</div>}>
      <Dashboard
        initialEvents={initialEvents}
        initialSearch={initialSearch}
        initialSeverity={initialSeverity}
      />
    </Suspense>
  );
}