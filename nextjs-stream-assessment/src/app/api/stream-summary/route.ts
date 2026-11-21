import { NextRequest } from "next/server";
import { ALL_EVENTS } from "@/lib/mockData";

// Resolves after `ms`, or immediately (returning false) if the signal aborts first
function abortableSleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  // No silent fallback: a wrong ID must never stream another event's report
  const event = eventId ? ALL_EVENTS.find((e) => e.id === eventId) : undefined;
  if (!event) {
    return new Response("Event not found", { status: 404 });
  }

  const report = [
    `### Incident Analysis for ${event.id} (${event.service})\n\n`,
    `**Severity:** ${event.severity.toUpperCase()} | **Detected:** ${event.timestamp}\n\n`,
    `**Root Cause Assessment:** Telemetry from \`${event.service}\` indicates elevated tail latency correlated with connection pool saturation. `,
    `Automatic retries amplified downstream concurrency by 3.2x during the observation window.\n\n`,
    `**Recommended Remediation:**\n`,
    `1. Enforce bounded concurrency semaphore on outbound worker tasks.\n`,
    `2. Verify idempotency keys before replaying failed webhook deliveries.\n`,
    `3. Check node memory pressure on \`eu-south-1a\` cluster.\n`,
  ].join("");

  const tokens = report.split(" ");
  const encoder = new TextEncoder();
  const { signal } = request;

  // Set when the consumer cancels the stream (client disconnect / abort)
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Initial model cold-start delay, interruptible
        if (!(await abortableSleep(250, signal))) return;

        for (const word of tokens) {
          if (cancelled || signal.aborted) return; // stop producing, do NOT close
          controller.enqueue(encoder.encode(word + " "));
          if (!(await abortableSleep(45, signal))) return;
        }

        if (!cancelled) controller.close();
      } catch {
        // Controller already closed/cancelled by the runtime: nothing left to do
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}