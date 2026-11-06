import { SourcesScreen } from "@/screens/sources/SourcesScreen";
import { noAttention, type ScreenDefinition } from "@/screens/types";

export { InstallHost } from "@/screens/sources/install/InstallHost";
export { openInstall, type InstallRequest } from "@/screens/sources/install/store";

export const screen: ScreenDefinition = {
  id: "sources",
  label: "Sources",
  Screen: SourcesScreen,
  useAttention: noAttention,
};
