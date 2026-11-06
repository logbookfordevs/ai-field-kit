import { useOperation } from "@/api/hooks";
import { pollEvery, type ToolRun } from "@/screens/tools/types";

/** Follows a tool's command while it runs; anything left from an earlier run is not reported. */
export function useLiveRun(id: number | undefined, running: boolean): ToolRun | undefined {
  const state = useOperation("tool/state", {}, { enabled: running, refetchInterval: running ? pollEvery : false });
  const run = id === undefined ? undefined : state.data?.runs[id];
  return running && run?.pending ? run : undefined;
}
