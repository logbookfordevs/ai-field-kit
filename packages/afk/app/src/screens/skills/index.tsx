import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function SkillsScreen() {
  return <Placeholder title="Skills" />;
}

export const screen: ScreenDefinition = {
  id: "skills",
  label: "Skills",
  Screen: SkillsScreen,
  useAttention: noAttention,
};
