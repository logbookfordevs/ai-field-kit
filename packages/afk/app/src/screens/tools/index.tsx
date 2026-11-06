import { ToolsScreen } from "@/screens/tools/ToolsScreen";
import { noAttention, type ScreenDefinition } from "@/screens/types";

export const screen: ScreenDefinition = {
  id: "tools",
  label: "Tools",
  Screen: ToolsScreen,
  useAttention: noAttention,
};
