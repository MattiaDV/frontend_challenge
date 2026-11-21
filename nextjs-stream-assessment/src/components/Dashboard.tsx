"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SystemEvent } from "@/lib/mockData"; // type-only: erased at build
import { filtersKey, parseSeverity, type SeverityFilter } from "@/lib/filter";
import { useRenderCount } from "@/lib/useRenderCount";
import { FilterBar } from "@/components/FilterBar";
import { EventList } from "@/components/EventList";
import { AiSummary } from "@/components/AiSummary";

const DEBOUNCE_MS = 300;

type DashboardProps = {
  initialEvents: SystemEvent[];
  initialSearch: string;
  initialSeverity: SeverityFilter;
};

export function Dashboard({ initialEvents, initialSearch, initialSeverity }: DashboardProps) {
  const renders = useRenderCount();
  const searchParams = useSearchParams();

  // URL = source of truth for committed filters
  const urlSearch = searchParams.get("search") ?? "";
  const urlSeverity = parseSeverity(searchParams.get("severity"));

  // Local text only so typing stays instant; committed to the URL after a pause
  const [searchInput, setSearchInput] = useState(urlSearch);
  const searchInputRef = useRef(searchInput);
  const lastSyncedSearchRef = useRef(urlSearch);

  // Initial data comes from the server; no loading flash on first paint
  const [events, setEvents] = useState<SystemEvent[]>(initialEvents);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const loadedKeyRef = useRef(filtersKey(initialSearch, initialSeverity));

  // The ONLY analysis-related state here: which event is selected.
  // Streaming state lives inside <AiSummary>, so tokens never re-render this component.
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  // Keep a ref to the latest input so handleSeverityChange can stay referentially stable
  useEffect(() => {
    searchInputRef.current = searchInput;
  }, [searchInput]);

  // Write filters to the URL (one history entry per committed change)
  const pushFilters = useCallback((nextSearch: string, nextSeverity: SeverityFilter) => {
    const params = new URLSearchParams();
    if (nextSearch) params.set("search", nextSearch);
    if (nextSeverity !== "all") params.set("severity", nextSeverity);
    const qs = params.toString();
    lastSyncedSearchRef.current = nextSearch;
    window.history.pushState(null, "", qs ? `/?${qs}` : "/");
  }, []);

  // URL -> input: only for EXTERNAL changes (Back/Forward), never our own pushes
  useEffect(() => {
    if (urlSearch !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = urlSearch;
      setSearchInput(urlSearch);
    }
  }, [urlSearch]);

  // Input -> URL, debounced
  useEffect(() => {
    if (searchInput === urlSearch) return;
    const timer = setTimeout(() => pushFilters(searchInput, urlSeverity), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, urlSearch, urlSeverity, pushFilters]);

  // Fetch events whenever the COMMITTED filters change
  useEffect(() => {
    const key = filtersKey(urlSearch, urlSeverity);

    // Data for these filters is already on screen (server render, or Back to it)
    if (key === loadedKeyRef.current) {
      setLoadingEvents(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    setLoadingEvents(true);

    const params = new URLSearchParams();
    if (urlSearch) params.set("search", urlSearch);
    if (urlSeverity !== "all") params.set("severity", urlSeverity);

    (async () => {
      try {
        const res = await fetch(`/api/events?${params.toString()}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (signal.aborted) return; // outdated response: never write it
        loadedKeyRef.current = key;
        setEvents(data.events ?? []);
        setLoadingEvents(false);
      } catch (err) {
        if (signal.aborted || (err as Error).name === "AbortError") return;
        console.error("Events fetch failed:", err);
        setLoadingEvents(false);
      }
    })();

    return () => controller.abort();
  }, [urlSearch, urlSeverity]);

  // A filter change deselects the event; <AiSummary>'s effect cleanup aborts the stream
  useEffect(() => {
    setSelectedEvent(null);
  }, [urlSearch, urlSeverity]);

  // Stable callbacks so the memoized children can actually skip renders
  const handleSeverityChange = useCallback(
    (value: string) => pushFilters(searchInputRef.current, parseSeverity(value)),
    [pushFilters]
  );
  const handleSelect = useCallback((evt: SystemEvent) => setSelectedEvent(evt), []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", height: "100vh", overflow: "hidden" }}>
      {/* Left Pane: Filters & 500-Row Event Feed */}
      <div style={{ borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <FilterBar
          searchInput={searchInput}
          severity={urlSeverity}
          onSearchChange={setSearchInput}
          onSeverityChange={handleSeverityChange}
        />
        <EventList
          events={events}
          loading={loadingEvents}
          selectedId={selectedEvent?.id ?? null}
          onSelect={handleSelect}
        />
        <div suppressHydrationWarning style={{ padding: "4px 16px", fontSize: "12px", color: "#64748b", borderTop: "1px solid #1e293b" }}>
            Dashboard renders: {renders}
        </div>
      </div>

      {/* Right Pane: owns all streaming state */}
      <AiSummary event={selectedEvent} />
    </div>
  );
}