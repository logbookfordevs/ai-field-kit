import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function ToolsScreen() {
  return <Placeholder title="Tools" />;
}

export const screen: ScreenDefinition = {
  id: "tools",
  label: "Tools",
  Screen: ToolsScreen,
  useAttention: noAttention,
};
