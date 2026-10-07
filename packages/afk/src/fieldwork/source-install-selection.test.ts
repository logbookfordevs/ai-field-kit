import { expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import * as installer from "./skill-install.js";

it("forwards run-only selection without editing the source and rejects empty or broadened selections", async () => {
  const home=await mkdtemp(join(tmpdir(),"afk-install-selection-"));
  const store=new SettingsStore(home);await store.initialize();
  const settings=await store.read();settings.favoriteSources=[{name:"All",source:"owner/all"},{name:"Selected",source:"owner/some",skills:["review"]}];await store.save(settings);
  const run=vi.spyOn(installer,"installSkills").mockResolvedValue({pending:false,phase:"Complete",output:"",scope:"Global",agent:"codex",label:"All",completed:1,total:1,code:0});
  const api=new FieldworkOperations(store);
  try {
    await api.run("source/install",{source:"owner/all",scope:"Global",agent:"codex",skills:["video"]});
    expect(run.mock.calls[0]?.[2]).toEqual([{name:"All",source:"owner/all",skills:["video"]}]);
    expect((await store.read()).favoriteSources[0]).not.toHaveProperty("skills");
    await expect(api.run("source/install",{source:"owner/all",scope:"Global",agent:"codex",skills:[]})).rejects.toThrow("unique skill names");
    await expect(api.run("source/install",{source:"owner/some",scope:"Global",agent:"codex",skills:["video"]})).rejects.toThrow("saved selection");
    expect(run).toHaveBeenCalledTimes(1);
  } finally {await api.close();vi.restoreAllMocks();await rm(home,{recursive:true,force:true});}
});
