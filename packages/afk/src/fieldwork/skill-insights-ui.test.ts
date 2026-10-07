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
  const context=createContext({inventory:()=>entries,inventories:{Global:entries},scope:"Global",profiles: [], profileFilter: "", sourceFilter:"",availabilityFilter:"",query:"",invocationFilter:"",invocationSummary:()=>"automatic allowed",esc:String,$:()=>fields.skillTokenDetails});
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
it("calculates inspected full content only after the explicit request",()=>{
  const ui=fixture();
  ui.run("inspectedSkill={name:'auto',scope:'Global',file:'SKILL.md',content:'x'.repeat(400)}");
  expect(ui.run("tokenEstimateCache.size")).toBe(0);
  ui.run("showSkillTokenEstimate()");
  expect(ui.fields.skillTokenDetails.innerHTML).toContain("Full instructions: ~100 tokens");
});

it("filters available and disabled entries independently of invocation",()=>{
  const ui=fixture();
  ui.run("availabilityFilter='disabled'");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["disabled"]);
  ui.run("availabilityFilter='available'");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["auto","local"]);
});

it("filters saved profile membership including disabled profiles and overlapping members",()=>{
  const ui=fixture();
  ui.context.profiles=[
    {id:"studio",name:"Studio",skills:["auto","disabled"],enabled:[]},
    {id:"review",name:"Review",skills:["auto"],enabled:["Global"]},
    {id:"missing",name:"Missing",skills:["not-installed"],enabled:[]},
  ];
  ui.run("profileFilter='__any'");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["auto","disabled"]);
  ui.run("profileFilter='__none'");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["local"]);
  ui.run("profileFilter='studio';availabilityFilter='disabled';sourceFilter='owner/b'");
  expect(ui.run("inventory().filter(matchesSkillFilters).map(entry=>entry.name)")).toEqual(["disabled"]);
  expect(ui.run("installedProfiles().map(profile=>profile.id)")).toEqual(["studio","review"]);
  ui.context.inventory=()=>[entries[2]];
  expect(ui.run("installedProfiles()")).toEqual([]);
  expect(ui.run("inventory().filter(matchesSkillFilters)")).toEqual([]);
});


it("updates discovery totals only with profile membership and excludes disabled members",()=>{
  const ui=fixture();
  ui.context.button=(label:string)=>label;
  ui.context.profiles=[{id:"disabled-only",skills:["disabled"]}];
  expect(ui.run<string>("skillTokenSummary()")).not.toContain("Codex ~0");
  ui.run("profileFilter='disabled-only'");
  expect(ui.run<string>("skillTokenSummary()")).toContain("Codex ~0");
  expect(ui.run<string>("skillTokenSummary()")).toContain("Claude ~0");
  ui.run("profileFilter=''");
  const baseline=ui.run<string>("skillTokenSummary()");
  ui.run("query='nothing-matches';sourceFilter='owner/b';availabilityFilter='disabled';invocationFilter='manual only'");
  expect(ui.run<string>("skillTokenSummary()")).toBe(baseline);
  expect(ui.run<string>("skillTokenSummary()")).not.toContain("Codex ~0");
});
