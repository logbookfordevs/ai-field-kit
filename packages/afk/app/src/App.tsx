import type { AfkClient } from "@/api/client";
import { ClientProvider } from "@/api/ClientProvider";
import { ToastProvider } from "@/components/Toast";
import { FirstRunGate } from "@/first-run/FirstRunGate";
import { Shell } from "@/shell/Shell";

export function App({ client }: { client: AfkClient }) {
  return (
    <ClientProvider client={client}>
      <ToastProvider>
        <FirstRunGate>
          <Shell />
        </FirstRunGate>
      </ToastProvider>
    </ClientProvider>
  );
}
