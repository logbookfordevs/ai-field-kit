import { cp } from "node:fs/promises";

await cp(
  new URL("../../../skills/afk-cli/", import.meta.url),
  new URL("../skills/afk-cli/", import.meta.url),
  { recursive: true },
);
