import { expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";

it("uses scoped receipts, inherits provenance only for shared project entries and tolerates missing receipts", async () => {
  const home=await mkdtemp(join(tmpdir(),"afk-provenance-"));
  try {
    const store=new SettingsStore(home);await store.initialize();
    const settings=await store.read();settings.projects.push({name:"Demo",path:join(home,"project")});
    const library=new SkillLibrary(store),globalRoot=library.root(settings,"Global"),projectRoot=library.root(settings,"Demo");
    await mkdir(join(globalRoot,"sample"),{recursive:true});
    await writeFile(join(globalRoot,"sample/SKILL.md"),"---\nname: sample\ndescription: test\n---\nInstructions");
    await writeFile(join(home,".agents/.skill-lock.json"),JSON.stringify({skills:{sample:{source:"owner/global"}}}));
    await mkdir(projectRoot,{recursive:true});await symlink(join(globalRoot,"sample"),join(projectRoot,"sample"));
    expect((await library.inventory(settings,"Demo"))[0]?.source).toBe("owner/global");
    await writeFile(join(home,"project/skills-lock.json"),JSON.stringify({skills:{sample:{source:"owner/project"}}}));
    expect((await library.inventory(settings,"Demo"))[0]?.source).toBe("owner/project");
    await rm(join(home,"project/skills-lock.json"));await rm(join(home,".agents/.skill-lock.json"));
    expect((await library.inventory(settings,"Global"))[0]?.source).toBeUndefined();
  } finally {await rm(home,{recursive:true,force:true});}
});
