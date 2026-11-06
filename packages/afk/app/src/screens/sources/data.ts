import { useOperation, type Read } from "@/api/hooks";
import type { SourcesState } from "@/screens/sources/types";

/**
 * The `state` operation as this screen reads it. Other screens type the same
 * operation for what they need, so each keeps its own view instead of sharing one declaration.
 */
export function useSourcesState(): Read<SourcesState> {
  return useOperation("state") as unknown as Read<SourcesState>;
}
