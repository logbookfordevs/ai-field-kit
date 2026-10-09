import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.useRealTimers(); });

function setup(fetch: ReturnType<typeof vi.fn>) {
  vi.useFakeTimers();
  const target = { innerHTML: "", textContent: "" };
  const listeners = new Map<string, () => void>();
  const document = { hidden: false, addEventListener: (event: string, handler: () => void) => listeners.set(event, handler) };
  const context = createContext({
    $: () => target, document, window: { afkToken: "fixture", addEventListener: vi.fn() },
    fetch, Date, Number, Math, AbortController, setTimeout, clearTimeout,
  });
  runInContext(readFileSync(new URL("../../web/runtime-status.js", import.meta.url), "utf8"), context);
  return { target, document, listeners, context };
}

it("displays server PID and RSS, refreshing every 30 seconds only while visible", async () => {
  const fetch = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ pid: 123, rssBytes: 64 * 1024 * 1024 }) }));
  const { target, document, listeners } = setup(fetch);
  await vi.advanceTimersByTimeAsync(0);
  expect(target.innerHTML).toBe("Running · PID 123<br>RSS 64.0 MiB");
  expect(fetch.mock.calls[0]?.[0]).toBe("/api/status");
  await vi.advanceTimersByTimeAsync(29_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  document.hidden = true; listeners.get("visibilitychange")!();
  await vi.advanceTimersByTimeAsync(90_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  document.hidden = false; listeners.get("visibilitychange")!();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("does not overlap requests and replaces stale status when disconnected", async () => {
  let fail!: (error: Error) => void;
  const fetch = vi.fn(() => new Promise((_resolve, reject) => { fail = reject; }));
  const { target, context } = setup(fetch);
  await vi.advanceTimersByTimeAsync(0);
  await runInContext("refreshRuntimeStatus()", context);
  expect(fetch).toHaveBeenCalledTimes(1);
  fail(new Error("Offline"));
  await vi.advanceTimersByTimeAsync(0);
  expect(target.textContent).toBe("Disconnected");
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("times out a stalled status request and can recover on the next refresh", async () => {
  const fetch = vi.fn((_url: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("Aborted")));
  }));
  const { target } = setup(fetch);
  await vi.advanceTimersByTimeAsync(5000);
  expect(target.textContent).toBe("Disconnected");
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(25_000);
  expect(fetch).toHaveBeenCalledTimes(2);
});
