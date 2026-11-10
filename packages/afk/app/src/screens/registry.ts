import { screen as backup } from "@/screens/backup";
import { screen as overview } from "@/screens/overview";
import { screen as packs } from "@/screens/packs";
import { screen as rules } from "@/screens/rules";
import { screen as settings } from "@/screens/settings";
import { screen as skills } from "@/screens/skills";
import { screen as sources } from "@/screens/sources";
import { screen as tools } from "@/screens/tools";
import type { ScreenDefinition } from "@/screens/types";

/** Navigation order, in groups separated by a rule. Each screen owns its folder; this list does not change per screen. */
export const navigation: ScreenDefinition[][] = [
  [overview, skills, packs, sources],
  [rules, tools, backup, settings],
];
