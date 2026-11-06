import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError, Result } from "@/api/client";
import { useClient } from "@/api/ClientProvider";
import type { OperationInput, OperationName, OperationResult } from "@/api/operations";

class OperationError extends Error {
  constructor(readonly api: ApiError) {
    super(api.message);
  }
}

export interface Read<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  /** Refetches; resolves once the new value or error is in place. */
  reload: () => Promise<void>;
}

export interface ReadOptions {
  enabled?: boolean;
  /** Poll while a value is in progress, in milliseconds; false stops. */
  refetchInterval?: number | false;
}

/** Reads an operation and keeps it fresh. Failures come back as `error`, never thrown into rendering. */
export function useOperation<K extends OperationName>(operation: K, input?: OperationInput<K>, options: ReadOptions = {}): Read<OperationResult<K>> {
  const client = useClient();
  const query = useQuery({
    queryKey: [operation, input ?? {}],
    queryFn: async () => {
      const result = await client.run(operation, input);
      if (!result.ok) throw new OperationError(result.error);
      return result.value;
    },
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval ?? false,
  });
  const { refetch } = query;
  const reload = useCallback(async () => { await refetch(); }, [refetch]);
  const error = query.error instanceof OperationError ? query.error.api : query.error ? { message: query.error.message, status: 0, details: {} } : null;
  return { data: query.data, error, loading: query.isPending && query.fetchStatus !== "idle", reload };
}

export interface Change<K extends OperationName> {
  run: (input?: OperationInput<K>) => Promise<Result<OperationResult<K>>>;
  pending: boolean;
  error: ApiError | null;
  reset: () => void;
}

/** Runs a changing operation. On success every read refreshes, so navigation signals and other screens stay current. */
export function useMutation<K extends OperationName>(operation: K): Change<K> {
  const client = useClient();
  const queries = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(async (input?: OperationInput<K>) => {
    setPending(true);
    setError(null);
    const result = await client.run(operation, input);
    setPending(false);
    if (result.ok) await queries.invalidateQueries();
    else setError(result.error);
    return result;
  }, [client, operation, queries]);
  const reset = useCallback(() => setError(null), []);
  return { run, pending, error, reset };
}
