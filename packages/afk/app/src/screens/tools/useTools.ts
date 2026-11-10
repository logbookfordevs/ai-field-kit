import { useCallback, useState } from "react";
import type { ApiError } from "@/api/client";
import { useClient } from "@/api/ClientProvider";
import { useMutation } from "@/api/hooks";
import type { ToolEntry } from "@/screens/tools/types";

function savedTools(value: unknown): { document: Record<string, unknown>; tools: ToolEntry[] } | null {
  const settings = (value as { settings?: unknown } | null)?.settings;
  if (!settings || typeof settings !== "object") return null;
  const document = settings as Record<string, unknown>;
  return Array.isArray(document.tools) ? { document, tools: document.tools as ToolEntry[] } : null;
}

/**
 * Saves a change to the tool list. Tools live inside the whole settings document, so this reads the
 * current document just before writing and changes only `tools`; everything else is carried over.
 */
export function useSaveTools(): { save: (change: (tools: ToolEntry[]) => ToolEntry[]) => Promise<ApiError | null>; pending: boolean } {
  const client = useClient();
  const { run: writeSettings } = useMutation("settings");
  const [pending, setPending] = useState(false);

  const save = useCallback(async (change: (tools: ToolEntry[]) => ToolEntry[]) => {
    setPending(true);
    try {
      const current = await client.run("state");
      if (!current.ok) return current.error;
      const read = savedTools(current.value);
      if (!read) return { message: "AFK sent settings it couldn't read.", status: 0, details: {} };
      const result = await writeSettings({ settings: { ...read.document, tools: change(read.tools) } });
      return result.ok ? null : result.error;
    } finally {
      setPending(false);
    }
  }, [client, writeSettings]);

  return { save, pending };
}
