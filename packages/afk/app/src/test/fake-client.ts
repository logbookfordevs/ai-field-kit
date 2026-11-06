import type { AfkClient, ApiError, AppUpdateJob, VersionCheck } from "@/api/client";
import type { OperationName } from "@/api/operations";

class Failure {
  constructor(readonly error: ApiError) {}
}

/** Return from a handler to make the operation fail with this message. */
export function fail(message: string, extra: Partial<Omit<ApiError, "message">> = {}): Failure {
  return new Failure({ message, status: 400, details: {}, ...extra });
}

type Handler = (input: Record<string, unknown>) => unknown;

export interface FakeClient extends AfkClient {
  /** Every operation called, in order, with its input. */
  calls: { operation: OperationName; input: Record<string, unknown> }[];
}

/**
 * A client backed by handlers instead of a server. A handler returns the
 * operation's value (or a promise of it), or `fail(...)`.
 * Operations without a handler fail with "Unknown operation.".
 */
export function fakeClient(handlers: Partial<Record<OperationName, Handler>> = {}, app: { version?: VersionCheck; job?: AppUpdateJob | null; exit?: () => void } = {}): FakeClient {
  const calls: FakeClient["calls"] = [];
  return {
    calls,
    run: async (operation, input) => {
      const data = (input ?? {}) as Record<string, unknown>;
      calls.push({ operation, input: data });
      const handler = handlers[operation];
      if (!handler) return { ok: false, error: { message: "Unknown operation.", status: 404, details: {} } };
      const reply = await handler(data);
      if (reply instanceof Failure) return { ok: false, error: reply.error };
      return { ok: true, value: reply as never };
    },
    app: {
      status: async () => ({ ok: true, value: { pid: 1, rssBytes: 1, settingsPath: "/tmp/afk/settings.json" } }),
      updateCheck: async () => ({ ok: true, value: app.version ?? { current: "2.1.0", available: false } }),
      updateState: async () => ({ ok: true, value: app.job ?? null }),
      update: async () => ({ ok: true, value: { started: true } }),
      exit: async () => { app.exit?.(); return { ok: true, value: { ok: true } }; },
    },
  };
}
