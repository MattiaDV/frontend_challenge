import { NextRequest, NextResponse } from "next/server";
import { ALL_EVENTS } from "@/lib/mockData";
import { filterEvents } from "../../../lib/event";
import { parseSeverity } from "../../../lib/filter";

function abortableSleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const severity = parseSeverity(searchParams.get("severity"));

  const delay = 150 + Math.floor(Math.random() * 400);
  try {
    await abortableSleep(delay, request.signal);
  } catch {
    // Client cancelled: nobody is listening, stop here
    return new NextResponse(null, { status: 499 });
  }

  const filtered = filterEvents(search, severity);
  return NextResponse.json({ events: filtered, total: filtered.length });
}