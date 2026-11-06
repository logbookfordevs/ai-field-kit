import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/shell/Page";

/** Stands in for a section until its screen lands in the new app. */
export function Placeholder({ title }: { title: string }) {
  return (
    <Page title={title}>
      <EmptyState title="This page is still being rebuilt" actions={<a className="button-link" href="/">Open the current app</a>}>
        Everything here works in the current app for now.
      </EmptyState>
    </Page>
  );
}
