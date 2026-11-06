import { Page } from "@/shell/Page";
import { noAttention, type ScreenDefinition } from "@/screens/types";
import { AgentFolders } from "@/screens/settings/AgentFolders";
import { InvocationDefaults } from "@/screens/settings/InvocationDefaults";
import { Library } from "@/screens/settings/Library";
import { Projects } from "@/screens/settings/Projects";
import { Schedule } from "@/screens/settings/Schedule";
import { SettingsSection } from "@/screens/settings/SettingsSection";

function SettingsScreen() {
  return (
    <Page title="Settings" description="Where your library lives, which folders your agents read, your projects and automatic updates.">
      <SettingsSection title="Your library" description="Every skill AFK manages is stored here and linked into agent folders.">
        <Library />
      </SettingsSection>
      <SettingsSection title="Agent folders" description="Every skill that is on gets a link in each folder that is on. Agents read different folders, so switch on the ones you use.">
        <AgentFolders />
      </SettingsSection>
      <SettingsSection title="Projects" description="AFK installs, updates and deletes skills inside a project's own repository. Changes show up in the project's Git status. Packs stay Global.">
        <Projects />
      </SettingsSection>
      <SettingsSection title="Automatic skill updates" description="Updates Global skills on this machine with the same protected update as the Skills page. Runs only while AFK is open; a run missed while it was closed happens shortly after AFK starts.">
        <Schedule />
      </SettingsSection>
      <SettingsSection title="Invocation defaults" description="Global overrides apply to every project that inherits them.">
        <InvocationDefaults />
      </SettingsSection>
    </Page>
  );
}

export const screen: ScreenDefinition = {
  id: "settings",
  label: "Settings",
  Screen: SettingsScreen,
  useAttention: noAttention,
};
