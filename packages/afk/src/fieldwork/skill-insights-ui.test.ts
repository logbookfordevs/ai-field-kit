import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";

const script=readFileSync(new URL("../../web/skill-insights.js",import.meta.url),"utf8");
const entries=[
  {name:"auto",description:"Automatic guidance",source:"owner/a",available:true,invocation:{codex:"Automatic allowed",claude:"Manual only"}},
  {name:"disabled",source:"owner/b",available:false,invocation:{codex:"Automatic allowed",claude:"Automatic allowed"}},
  {name:"local",available:true,invocation:{codex:"Manual only",claude:"Manual only"}},
];
function fixture(){
  const fields={skillTokenDetails:{innerHTML:""}};
  const context=createContext({inventory:()=>entries,inventories:{Global:entries},scope:"Global",sourceFilter:"",query:"",invocationFilter:"",invocationSummary:()=>"automatic allowed",esc:String,$:()=>fields.skillTokenDetails});
  runInContext(script,context);
  return {context,fields,run:<T>(code:string)=>runInContext(code,context) as T};
}
it("counts only available automatic entries per agent and deduplicates shared names",()=>{
  const ui=fixture();
  expect(ui.run("automaticTokenEstimate([...inventory(),...inventory()],'codex').count")).toBe(1);
  expect(ui.run("automaticTokenEstimate(inventory(),'claude').count")).toBe(0);
  expect(ui.run<number>("tokenEstimateCache.size")).toBe(1);
});
it("combines source, invocation and name filters and limits source options to inventory",()=>{
  const ui=fixture();
  ui.run("sourceFilter='owner/a';query='aut';invocationFilter='automatic allowed'");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["auto"]);
  ui.run("sourceFilter='__local';query=''");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["local"]);
  expect(ui.run<string>("installedSourceOptions()")).toContain("Unknown / local");
});
it("ignores search, source and invocation filters in the discovery total",()=>{
  const ui=fixture();
  ui.context.button=(label:string)=>label;
  const baseline=ui.run<string>("skillTokenSummary()");
  ui.run("query='nothing-matches';sourceFilter='owner/b';invocationFilter='manual only'");
  expect(ui.run<string>("skillTokenSummary()")).toBe(baseline);
  expect(ui.run<string>("skillTokenSummary()")).not.toContain("Codex ~0");
});
it("calculates inspected full content only after the explicit request",()=>{
  const ui=fixture();
  ui.run("inspectedSkill={name:'auto',scope:'Global',file:'SKILL.md',content:'x'.repeat(400)}");
  expect(ui.run("tokenEstimateCache.size")).toBe(0);
  ui.run("showSkillTokenEstimate()");
  expect(ui.fields.skillTokenDetails.innerHTML).toContain("Full instructions: ~100 tokens");
});

it("keeps nested skills out of the source filter and groups them by folder",()=>{
  const ui=fixture();
  ui.run("invocationSummary=policy=>policy.claude==='Manual only'?'manual only':'automatic allowed'");
  ui.run("nested=[{name:'pdf',folder:'synced/acct',invocation:{claude:'Automatic allowed'}},{name:'docx',folder:'synced/acct',invocation:{claude:'Manual only'}},{name:'plan',folder:'team',invocation:{claude:'Manual only'}}]");
  expect(ui.run("nestedSkillGroups(nested).map(group=>[group.folder,group.skills.length])")).toEqual([["synced/acct",2],["team",1]]);
  ui.run("query='SYNCED';invocationFilter='manual only'");
  expect(ui.run("nested.filter(matchesNestedSkillFilters).map(entry=>entry.name)")).toEqual(["docx"]);
  ui.run("query='';invocationFilter=''");
  expect(ui.run<unknown[]>("nested.filter(matchesNestedSkillFilters)")).toHaveLength(3);
  ui.run("sourceFilter='owner/a'");
  expect(ui.run("nested.filter(matchesNestedSkillFilters)")).toEqual([]);
  expect(ui.run("shortFolderPath('synced/937583ee-01ae-4eb2-a899-07800134a783_0ac2e7dd')")).toBe("synced/937583ee…e7dd");
});
