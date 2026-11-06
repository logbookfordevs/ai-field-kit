import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function RulesScreen() {
  return <Placeholder title="Agent rules" />;
}

export const screen: ScreenDefinition = {
  id: "rules",
  label: "Agent rules",
  Screen: RulesScreen,
  useAttention: noAttention,
};
