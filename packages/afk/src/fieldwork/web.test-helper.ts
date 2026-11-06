import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const publicFiles = fileURLToPath(new URL("../../app/public", import.meta.url));

export async function fixtureWeb(parent: string): Promise<string> {
  const web = join(parent, "web");
  await mkdir(web, { recursive: true });
  await cp(publicFiles, web, { recursive: true });
  await writeFile(join(web, "index.html"), "<script>/* AFK_SESSION */</script><script type=\"module\" src=\"/assets/app.js\"></script>");
  return web;
}
