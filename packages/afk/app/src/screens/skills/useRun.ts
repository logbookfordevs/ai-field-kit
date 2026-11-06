import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Result } from "@/api/client";
import { useClient } from "@/api/ClientProvider";
import { refreshAfter } from "@/api/hooks";
import type { OperationInput, OperationName, OperationResult } from "@/api/operations";
import { useToast } from "@/components/Toast";

export type Run = <K extends OperationName>(operation: K, input?: OperationInput<K>, options?: { quiet?: boolean }) => Promise<Result<OperationResult<K>>>;

/** Runs any operation; success refreshes the reads it affects, failure shows the server's message unless `quiet`. */
export function useRun(): Run {
  const client = useClient();
  const queries = useQueryClient();
  const toast = useToast();
  return useCallback<Run>(async (operation, input, options = {}) => {
    const result = await client.run(operation, input);
    if (result.ok) await refreshAfter(queries, operation);
    else if (!options.quiet) toast.show(result.error.message);
    return result;
  }, [client, queries, toast]);
}

/** Reads an operation once when mounted, outside the shared cache, so a review stays as it was reviewed. */
export function useReview<K extends OperationName>(operation: K, input: OperationInput<K>): { data?: OperationResult<K>; error?: string } {
  const client = useClient();
  const [value, setValue] = useState<{ data?: OperationResult<K>; error?: string }>({});
  const key = JSON.stringify(input);
  useEffect(() => {
    let live = true;
    void client.run(operation, JSON.parse(key) as OperationInput<K>).then(result => {
      if (live) setValue(result.ok ? { data: result.value } : { error: result.error.message });
    });
    return () => { live = false; };
  }, [client, operation, key]);
  return value;
}
