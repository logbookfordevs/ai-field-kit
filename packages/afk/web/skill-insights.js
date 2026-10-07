let inspectedSkill;
const tokenEstimateCache=new Map();
function estimateTokens(text){
  if(tokenEstimateCache.has(text))return tokenEstimateCache.get(text);
  const estimate=Math.ceil(Array.from(text).length/4);
  if(tokenEstimateCache.size>=1000)tokenEstimateCache.clear();
  tokenEstimateCache.set(text,estimate);
  return estimate;
}
function discoveryEstimate(entry){return estimateTokens(entry.name+'\n'+(entry.description||''))}
function automaticTokenEstimate(entries,agent){
  const skills=[...new Map(entries.filter(entry=>entry.available&&entry.invocation?.[agent]==='Automatic allowed').map(entry=>[entry.name,entry])).values()];
  return {count:skills.length,tokens:skills.reduce((total,entry)=>total+discoveryEstimate(entry),0)};
}
function tokenSummaryLine(entries){
  return ['codex','claude'].map(agent=>{const value=automaticTokenEstimate(entries,agent);return `${agent==='codex'?'Codex':'Claude'}: ~${value.tokens.toLocaleString()} tokens · ${value.count} automatic skills`}).join(' / ');
}
function skillTokenSummary(){
  const codex=automaticTokenEstimate(inventory(),'codex'),claude=automaticTokenEstimate(inventory(),'claude');
  return button(`Discovery: Codex ~${codex.tokens.toLocaleString()} · Claude ~${claude.tokens.toLocaleString()} tokens`,'showDiscoveryEstimate()','text');
}
function showDiscoveryEstimate(){
  const project=scope!=='Global';
  modal('Automatic discovery estimate',`<p><strong>${esc(scope)}${project?' only':''}</strong></p><p>${esc(tokenSummaryLine(inventory()))}</p>${project?`<p>Including Global: ${esc(tokenSummaryLine([...(inventories.Global||[]),...inventory()]))}</p>`:''}<p class="hint">Rough estimate: one token per four characters in available automatic skills’ names and descriptions. Agent formatting, model tokenizers, full instructions and supporting files are excluded. Unknown invocation modes are not counted. Shared skill names count once; filters do not change this scope summary.</p>`);
}
function installedSourceOptions(){
  const sources=[...new Set(inventory().map(entry=>entry.source||'__local'))].sort();
  return sources.map(source=>`<option value="${esc(source)}" ${sourceFilter===source?'selected':''}>${esc(source==='__local'?'Unknown / local':source)}</option>`).join('');
}
function installedProfiles(){
  const names=new Set(inventory().map(entry=>entry.name));
  return profiles.filter(profile=>profile.skills.some(name=>names.has(name)));
}
function installedProfileOptions(){
  return installedProfiles().map(profile=>`<option value="${esc(profile.id)}" ${profileFilter===profile.id?'selected':''}>${esc(profile.name)}</option>`).join('');
}
function matchesProfileFilter(entry){
  if(!profileFilter)return true;
  const membership=profiles.filter(profile=>profile.skills.includes(entry.name));
  if(profileFilter==='__any')return membership.length>0;
  if(profileFilter==='__none')return membership.length===0;
  return membership.some(profile=>profile.id===profileFilter);
}
function matchesSkillFilters(entry){
  const availability=typeof availabilityFilter==='undefined'?'':availabilityFilter;
  return matchesProfileFilter(entry)&&(!availability||(availability==='available'?entry.available:!entry.available))&&entry.name.toLowerCase().includes(query.trim().toLowerCase())&&(!invocationFilter||invocationSummary(entry.invocation)===invocationFilter)&&(!sourceFilter||(entry.source||'__local')===sourceFilter);
}
function showSkillTokenEstimate(){
  if(!inspectedSkill)return;
  const entry=(inventories[inspectedSkill.scope]||[]).find(skill=>skill.name===inspectedSkill.name);
  const discovery=entry?`<p>Discovery (name + description): ~${discoveryEstimate(entry).toLocaleString()} tokens.</p>`:'';
  $('skillTokenDetails').innerHTML=`${discovery}<p>${inspectedSkill.file==='SKILL.md'?'Full instructions':'Selected file'}: ~${estimateTokens(inspectedSkill.content).toLocaleString()} tokens.</p><p class="hint">Text-length estimate at four characters per token, not actual context usage or billing. Supporting files are excluded. Full instructions are counted separately from discovery.</p>`;
}
