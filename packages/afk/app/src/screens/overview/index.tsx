import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function OverviewScreen() {
  return <Placeholder title="Overview" />;
}

export const screen: ScreenDefinition = {
  id: "overview",
  label: "Overview",
  Screen: OverviewScreen,
  useAttention: noAttention,
};
