import { useQuery } from "@tanstack/react-query";
import { useClient } from "@/api/ClientProvider";

const refreshMs = 30_000;

export function memoryLabel(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${Math.round(megabytes)} MB`;
}

/** The AFK server's resident memory, refreshed every 30 seconds while the page is visible. */
export function MemoryUse() {
  const client = useClient();
  const status = useQuery({
    queryKey: ["app", "status"],
    queryFn: async () => {
      const result = await client.app.status();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    refetchInterval: refreshMs,
    retry: false,
  });

  if (!status.data) return null;
  return (
    <p className="memory-use" title="Memory the AFK server is using right now. The browser tab is counted by your browser.">
      Using {memoryLabel(status.data.rssBytes)}
    </p>
  );
}
