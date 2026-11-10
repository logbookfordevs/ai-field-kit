import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import type { AfkClient } from "@/api/client";
import { ClientProvider } from "@/api/ClientProvider";
import { ToastProvider } from "@/components/Toast";
import { fakeClient } from "@/test/fake-client";

/** Renders inside the app's providers (client, data cache, toasts) with a fake client by default. */
export function renderWithApp(ui: ReactElement, { client = fakeClient() }: { client?: AfkClient } = {}): RenderResult {
  return render(
    <ClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </ClientProvider>,
  );
}
