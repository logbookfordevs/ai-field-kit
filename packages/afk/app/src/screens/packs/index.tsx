import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function PacksScreen() {
  return <Placeholder title="Packs" />;
}

export const screen: ScreenDefinition = {
  id: "packs",
  label: "Packs",
  Screen: PacksScreen,
  useAttention: noAttention,
};
