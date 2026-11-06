import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AfkClient } from "@/api/client";

const ClientContext = createContext<AfkClient | null>(null);

export function ClientProvider({ client, children }: { client: AfkClient; children: ReactNode }) {
  const [queries] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 2_000 } } }));
  return (
    <ClientContext.Provider value={client}>
      <QueryClientProvider client={queries}>{children}</QueryClientProvider>
    </ClientContext.Provider>
  );
}

export function useClient(): AfkClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("useClient needs a ClientProvider.");
  return client;
}
