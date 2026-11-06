import { useMutation } from "@/api/hooks";
import type { OperationInput, OperationName } from "@/api/operations";
import { useToast } from "@/components/Toast";

/** Runs a changing operation and reports the outcome in a toast; resolves true when it worked. */
export function useAction<K extends OperationName>(operation: K) {
  const change = useMutation(operation);
  const toast = useToast();
  const run = async (input: OperationInput<K>, done: string): Promise<boolean> => {
    const result = await change.run(input);
    if (result.ok) toast.show(done); else toast.fail(result.error.message);
    return result.ok;
  };
  return { run, pending: change.pending };
}
