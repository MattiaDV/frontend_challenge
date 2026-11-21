"use client";

import React from "react";
import type { SystemEvent } from "@/lib/mockData";
import { HeavyPayloadFormatter } from "@/components/HeavyPayloadFormatter";
import { useSummaryStream } from "@/hooks/useSummaryStream";
import { useRenderCount } from "@/lib/useRenderCount";

// memo: typing in the search box re-renders Dashboard, but `event` is unchanged, so this is skipped
export const AiSummary = React.memo(function AiSummary({ event }: { event: SystemEvent | null }) {
  const { text, status } = useSummaryStream(event?.id ?? null);
  const renders = useRenderCount();

  return (
    <div style={{ padding: "20px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "18px" }}>
          {event ? `Analysis: ${event.id}` : "Incident Summary"}
        </h2>
        {status === "streaming" && <span style={{ fontSize: "12px", color: "#38bdf8" }}>Streaming tokens...</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Streaming text: the only thing that changes per token */}
        <div
          style={{
            background: "#1e293b",
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #334155",
            whiteSpace: "pre-wrap",
            lineHeight: 1.55,
            minHeight: "180px",
          }}
        >
          {status === "error"
            ? "The analysis could not be loaded. Select the event again to retry."
            : text || "Select an event to generate an AI incident analysis..."}
        </div>

        {/* Depends only on rawPayload: skipped while tokens arrive */}
        <HeavyPayloadFormatter rawPayload={event?.rawPayload || "{}"} />
      </div>

      <div suppressHydrationWarning style={{ marginTop: "12px", fontSize: "12px", color: "#64748b" }}>Summary renders: {renders}</div>
    </div>
  );
});