"use client";

import React, { useMemo } from "react";
import { useRenderCount } from "@/lib/useRenderCount";

/**
 * Simulates an expensive markdown / syntax highlighting step (~12ms of sync work).
 * Kept as a pure function so useMemo can cache it by its only input: rawPayload.
 */
function formatPayload(rawPayload: string) {
  const start = performance.now();
  let checksum = 0;
  while (performance.now() - start < 12) {
    checksum = (checksum + 1) % 1000;
  }
  return { text: rawPayload, checksum };
}

type HeavyPayloadFormatterProps = {
  rawPayload: string;
};

// memo: skipped when rawPayload is unchanged (e.g. on every streamed token)
// useMemo: even if it renders, the expensive work only reruns when rawPayload changes
export const HeavyPayloadFormatter = React.memo(function HeavyPayloadFormatter({
  rawPayload,
}: HeavyPayloadFormatterProps) {
  const renders = useRenderCount();
  const formatted = useMemo(() => formatPayload(rawPayload), [rawPayload]);

  return (
    <details open data-checksum={formatted.checksum} suppressHydrationWarning>
      <summary style={{ cursor: "pointer", color: "#94a3b8", fontSize: "13px" }}>Raw Telemetry Payload</summary>
      <pre
        style={{
          background: "#020617",
          padding: "12px",
          borderRadius: "6px",
          fontSize: "12px",
          overflowX: "auto",
        }}
      >
        {formatted.text}
      </pre>
      <div suppressHydrationWarning style={{ fontSize: "12px", color: "#64748b" }}>Formatter renders: {renders}</div>
    </details>
  );
});