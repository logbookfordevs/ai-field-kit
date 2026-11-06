import { InstallDialog } from "@/screens/sources/install/InstallDialog";
import { closeInstall, useOpenedInstall } from "@/screens/sources/install/store";

/** Renders the install dialog once, for the whole app. Opened with `openInstall(...)`. */
export function InstallHost() {
  const opened = useOpenedInstall();
  return opened ? <InstallDialog key={opened.id} request={opened.request} onClose={closeInstall} /> : null;
}
