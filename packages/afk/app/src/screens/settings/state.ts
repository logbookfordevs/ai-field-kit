import { useOperation, type Read } from "@/api/hooks";
import type { SettingsSnapshot } from "@/screens/settings/types";

/** The settings-shaped parts of the `state` read; its full result carries much more that Settings does not use. */
export function useSettingsSnapshot(): Read<SettingsSnapshot> {
  const read = useOperation("state");
  return { ...read, data: read.data as SettingsSnapshot | undefined };
}
