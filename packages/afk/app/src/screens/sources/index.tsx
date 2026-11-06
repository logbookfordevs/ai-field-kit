import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function SourcesScreen() {
  return <Placeholder title="Sources" />;
}

export const screen: ScreenDefinition = {
  id: "sources",
  label: "Sources",
  Screen: SourcesScreen,
  useAttention: noAttention,
};
