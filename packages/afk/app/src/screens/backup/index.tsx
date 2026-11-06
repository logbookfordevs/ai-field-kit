import { Placeholder } from "@/screens/Placeholder";
import { noAttention, type ScreenDefinition } from "@/screens/types";

function BackupScreen() {
  return <Placeholder title="Backup" />;
}

export const screen: ScreenDefinition = {
  id: "backup",
  label: "Backup",
  Screen: BackupScreen,
  useAttention: noAttention,
};
