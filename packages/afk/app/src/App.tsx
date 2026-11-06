import type { AfkClient } from "@/api/client";
import { ClientProvider } from "@/api/ClientProvider";
import { ToastProvider } from "@/components/Toast";
import { InstallHost } from "@/screens/sources";
import { Shell } from "@/shell/Shell";

export function App({ client }: { client: AfkClient }) {
  return (
    <ClientProvider client={client}>
      <ToastProvider>
        <Shell />
        <InstallHost />
      </ToastProvider>
    </ClientProvider>
  );
}
