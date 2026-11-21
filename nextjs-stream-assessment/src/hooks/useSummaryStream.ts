"use client";

import { useEffect, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

export function useSummaryStream(eventId: string | null) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");

  useEffect(() => {
    if (!eventId) {
      setText("");
      setStatus("idle");
      return;
    }

    // One controller per analysis: this closure belongs to this event only
    const controller = new AbortController();
    const { signal } = controller;

    setText("");
    setStatus("streaming");

    (async () => {
      try {
        const res = await fetch(`/api/stream-summary?eventId=${encodeURIComponent(eventId)}`, { signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (signal.aborted) return; // stale chunk: drop it
          if (done) break;
          // Decode OUTSIDE the updater: updaters can run twice in Strict Mode
          const chunk = decoder.decode(value, { stream: true });
          setText((prev) => prev + chunk);
        }

        if (!signal.aborted) setStatus("done");
      } catch (err) {
        if (signal.aborted || (err as Error).name === "AbortError") return;
        console.error("Stream failed:", err);
        setStatus("error");
      }
    })();

    // Runs when the event changes AND on unmount
    return () => controller.abort();
  }, [eventId]);

  return { text, status };
}