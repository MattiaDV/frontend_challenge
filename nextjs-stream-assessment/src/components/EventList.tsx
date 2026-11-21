"use client";

import React from "react";
import type { SystemEvent } from "@/lib/mockData";
import { useRenderCount } from "@/lib/useRenderCount";

type EventRowProps = {
  evt: SystemEvent;
  selected: boolean;
  onSelect: (evt: SystemEvent) => void;
};

// Memoized row: re-renders only if its own event or selected state changes
const EventRow = React.memo(function EventRow({ evt, selected, onSelect }: EventRowProps) {
  return (
    <div
      onClick={() => onSelect(evt)}
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #1e293b",
        cursor: "pointer",
        background: selected ? "#1e293b" : "transparent",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500 }}>{evt.title}</div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          {evt.id} · {evt.timestamp}
        </div>
      </div>
      <span
        style={{
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "999px",
          background: evt.severity === "critical" ? "#7f1d1d" : evt.severity === "warning" ? "#78350f" : "#1e3a8a",
          color: "#f8fafc",
        }}
      >
        {evt.severity}
      </span>
    </div>
  );
});

type EventListProps = {
  events: SystemEvent[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (evt: SystemEvent) => void;
};

export const EventList = React.memo(function EventList({ events, loading, selectedId, onSelect }: EventListProps) {
  const renders = useRenderCount();

  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {loading && <div style={{ padding: "12px", color: "#94a3b8" }}>Loading events...</div>}
      {events.map((evt) => (
        <EventRow key={evt.id} evt={evt} selected={selectedId === evt.id} onSelect={onSelect} />
      ))}
      <div
        suppressHydrationWarning
        style={{
            position: "sticky",
            bottom: 0,
            padding: "4px 16px",
            fontSize: "12px",
            color: "#64748b",
            background: "#0f172a",
        }}
        >
        List renders: {renders}
        </div>
    </div>
  );
});