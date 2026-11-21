# Frontend Architecture & Debugging Decisions

## 1. Root-Cause Diagnosis

- **Stream cross-contamination:** `handleSelectEvent` started an independent `fetch` plus a `while (reader.read())` loop on every click, with no `AbortController` and no request guard. Clicking Event A and then Event B left two loops alive, and both appended to the same `summaryText` state (`setSummaryText(prev => prev + chunk)`), so their tokens interleaved. Nothing stopped them on unmount either. On the server, the stream route could not be interrupted during its sleeps, and an unknown `eventId` silently fell back to `evt_0001`, which could stream the wrong event's report.
- **Duplicate fetches & broken history navigation:** three cascading effects fought each other. Effect 1 pushed local state into the URL with `router.push` on every keystroke (one history entry per character), Effect 2 copied the URL back into local state (a feedback loop), and the fetch effect depended on that same state, so one change caused several fetches. There was no debounce and no cancellation, and the events API adds random 150-550ms jitter, so an older response could arrive last and overwrite newer results. Back/Forward replayed the per-character entries and the loop fought the restored values.
- **Render cascade during streaming:** `summaryText` lived in the top-level page component, so every streamed token re-rendered the whole page: the 500 event rows, the filter controls and `HeavyPayloadFormatter`. The formatter does ~12ms of synchronous work per render and also received `summaryText` as a prop, so it could not skip renders even in principle.

## 2. Server vs. Client Component Boundaries

**Server:** `app/page.tsx` has no `'use client'`. It awaits `searchParams` (a Promise in Next 15), validates `severity` with `parseSeverity`, loads the initial events with `filterEvents`, and renders `<Dashboard>` inside a `<Suspense>` boundary (required because `Dashboard` calls `useSearchParams`). The first paint therefore arrives with data in the HTML, with no loading flash and no initial `/api/events` request.

**Client (only where interactivity or browser APIs are needed):** `Dashboard` (URL sync, selection), `FilterBar`, `EventList`/`EventRow`, `AiSummary` (streaming), `HeavyPayloadFormatter`, and the `useSummaryStream` hook.

**Props crossing the boundary** (all serializable): `initialEvents: SystemEvent[]` (plain objects of strings and numbers; timestamps are ISO strings, not `Date`), `initialSearch: string`, `initialSeverity: "all" | "info" | "warning" | "critical"`. No functions or class instances cross it.

**Module split:** `lib/filters.ts` holds pure helpers (`parseSeverity`, `filtersKey`) and is safe for the client bundle. `lib/events.ts` imports the 500-event dataset and is only imported by server code (the page and the API route), so the data stays out of the client bundle. `SystemEvent` is imported as a type only. There is no `server-only` package; the boundary is by convention and checked in the build output.

## 3. Stream Cancellation & Race-Condition Strategy

**Client:** the stream lives in `useSummaryStream(eventId)`, an effect keyed on the event ID. Each run creates its own `AbortController`, and the effect cleanup calls `abort()`. That cleanup runs when the selected event changes and when the component unmounts. Inside the read loop, `if (signal.aborted) return` is checked after every `read()`, so a chunk that was already resolved when the abort happened is dropped. Each closure only ever sees its own `signal`, so a late chunk from an old stream cannot write into a newer one, and no request-ID counter is needed. `AbortError` is treated as expected and swallowed; only real failures set an error state. The text is reset at the start of every run.

**Server:** `/api/stream-summary` uses an `abortableSleep` tied to `request.signal`, so even the 250ms cold start wakes up immediately on abort. A `cancel()` hook sets a flag that the loop checks, and the abort path returns without calling `close()` or `enqueue()` on a cancelled controller (which would throw). An unknown or missing `eventId` returns 404 instead of silently streaming another event.

**A → B → A quickly:** selecting B runs A's cleanup, which aborts A's request. Selecting A again runs B's cleanup, which aborts B, and then starts a brand-new A stream with a fresh controller and empty text. A's first stream can never write again because its `signal` is aborted. The result is one clean report from the start, with no interleaving and no unhandled exceptions. There is no caching or resuming. Clicking the already-selected event does nothing, because the effect key is unchanged.

**Filter changes:** `Dashboard` sets `selectedEvent` to `null` when the committed filters change, which unselects the event and triggers the same cleanup that aborts the running stream.

## 4. State Synchronization & Render Performance

### Filters and the URL without a feedback loop

- The **URL is the single source of truth**: `urlSearch` and `urlSeverity` are derived from `useSearchParams` (unknown severities fall back to `all`). The only extra state is `searchInput`, a local copy used so typing stays instant.
- Each direction of sync is **guarded**. Input → URL runs after a 300ms debounce and is a no-op when the input already equals the URL. URL → input only runs when the URL differs from the last value this component wrote (`lastSyncedSearchRef`), which means Back/Forward. Severity commits immediately.
- Commits use `window.history.pushState`, not `router.push`/`router.replace`. In Next 15 this is integrated with `useSearchParams`, and it avoids a navigation that would re-run the Server Component page on every filter change.
- The fetch effect depends **only** on the committed URL values. It uses one `AbortController` per request and checks `signal.aborted` after `res.json()`, so an outdated response can never overwrite newer results. `loadedKeyRef` records which filters the current data belongs to, so the effect skips the fetch when that data is already on screen (the server render, or Back to it). This is idempotent under Strict Mode, unlike an "is first run" flag.

### How re-renders are prevented and verified

- **Isolation:** all streaming state lives inside `AiSummary`. `Dashboard` only holds `selectedEvent`, so tokens never re-render it.
- **Memoization:** `FilterBar`, `EventList`, `EventRow`, `HeavyPayloadFormatter` and `AiSummary` are wrapped in `React.memo`. Their props are stable: `useCallback` for handlers, and a ref for the latest search input so `handleSeverityChange` keeps one identity.
- **Formatter:** it no longer receives `summaryText`. It depends only on `rawPayload`, and its expensive work runs in `useMemo` keyed on `rawPayload`.
- **Verification:** a `useRenderCount` hook shows a render counter on `Dashboard`, `FilterBar`, `EventList`, `HeavyPayloadFormatter` and `AiSummary`. In a production build (`npm run build && npm start`; in dev, Strict Mode doubles renders), selecting an event and letting it stream raises only the "Summary renders" counter. The Dashboard, Filter, List and Formatter counters stay constant. Typing in the search box raises Dashboard and Filter but not List, Formatter or Summary. React DevTools Profiler ("Highlight updates") shows the same result.

## Trade-offs and limitations

- Each debounced search pause creates one history entry, so Back steps through search terms. `replaceState` would avoid that but would make Back skip intermediate searches.
- Changing filters clears the selected event instead of keeping a half-finished analysis on screen.
- The 404 for unknown events changes the old fallback behaviour on purpose: each event must have its own independent analysis.
- The render counters are diagnostics. They use `suppressHydrationWarning` because a client counter legitimately differs from the server's first render. They can be removed without affecting behaviour.
- The mock stream and events API simulate latency; a real backend would need the same abort handling on its side.