import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function SettingsScreen() {
  return <Placeholder title="Settings" />;
}

export const screen: ScreenDefinition = {
  id: "settings",
  label: "Settings",
  Screen: SettingsScreen,
  useAttention: noAttention,
};
