import type { OperationInput, OperationName, OperationResult } from "@/api/operations";

export interface ApiError {
  message: string;
  /** HTTP status, or 0 when AFK could not be reached. */
  status: number;
  code?: string;
  details: Record<string, unknown>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export interface VersionCheck { current: string; latest?: string; available: boolean; error?: string }
export interface AppUpdateJob { pending: boolean; phase: string; output: string; error?: string; targetVersion?: string }
export interface ServerStatus { pid: number; rssBytes: number; settingsPath: string }

export interface AfkClient {
  run<K extends OperationName>(operation: K, input?: OperationInput<K>): Promise<Result<OperationResult<K>>>;
  app: {
    status(): Promise<Result<ServerStatus>>;
    updateCheck(options?: { refresh?: boolean }): Promise<Result<VersionCheck>>;
    updateState(): Promise<Result<AppUpdateJob | null>>;
    update(): Promise<Result<{ started: boolean }>>;
  };
}

const unreachable = "AFK isn't responding. Check that it's still running, then try again.";

function failure(status: number, body: unknown): ApiError {
  if (!body || typeof body !== "object" || typeof (body as { error?: unknown }).error !== "string") {
    return { message: `AFK sent a reply it couldn't read (HTTP ${status}).`, status, details: {} };
  }
  const { error, code, ...details } = body as { error: string; code?: unknown } & Record<string, unknown>;
  return { message: error, status, ...(typeof code === "string" ? { code } : {}), details };
}

export function createClient(options: { token: string | undefined; fetch?: typeof fetch }): AfkClient {
  const fetcher = options.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(path: string, method: "GET" | "POST", input?: unknown): Promise<Result<T>> {
    let response: Response;
    try {
      response = await fetcher(`/api/${path}`, {
        method,
        headers: { "x-afk-token": options.token ?? "", ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        ...(method === "POST" ? { body: JSON.stringify(input ?? {}) } : {}),
        cache: "no-store",
      });
    } catch {
      return { ok: false, error: { message: unreachable, status: 0, details: {} } };
    }
    let body: unknown;
    try { body = await response.json(); } catch { body = undefined; }
    if (!response.ok) return { ok: false, error: failure(response.status, body) };
    if (body === undefined) return { ok: false, error: failure(response.status, undefined) };
    return { ok: true, value: body as T };
  }

  return {
    run: (operation, input) => request(operation, "POST", input),
    app: {
      status: () => request("status", "GET"),
      updateCheck: ({ refresh = false } = {}) => request(`app/update-check${refresh ? "?refresh=1" : ""}`, "GET"),
      updateState: () => request("app/update-state", "GET"),
      update: () => request("app/update", "POST"),
    },
  };
}
