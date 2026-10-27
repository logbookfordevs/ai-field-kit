function savedStacks(){return currentSettings.stacks||[]}
function stackGroups(manifest){
  return manifest.sources.map(group=>`<section class="stack-group"><h3>${esc(group.name)}</h3><code class="path">${esc(group.source)}</code><ul>${group.skills.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></section>`).join('');
}
function renderStacks(layout='list',controls=''){
  const stacks=savedStacks();
  const list=stacks.length?`<div class="ledger source-collection ${layout==='cards'?'source-gallery':''}">${stacks.map((stack,i)=>`<article class="row source-row"><div class="source-info"><h3>${esc(stack.manifest.name)} <span class="meta">Stack</span></h3>${stack.manifest.description?`<p class="sub">${esc(stack.manifest.description)}</p>`:''}<p class="meta">${stack.manifest.sources.length} sources · ${stack.manifest.sources.reduce((n,g)=>n+g.skills.length,0)} selected skills</p>${stack.origin?`<code class="path">${esc(stack.origin)}</code>`:'<span class="meta">Local manifest</span>'}<details class="source-members"><summary>Skills by source</summary>${stackGroups(stack.manifest)}</details>${stackProfilePanel(stack)}</div><div class="inline">${button('Install',`showInstallation('stack',${i})`)}${button(stackProfile(stack)?'Update profile':'Turn into profile',`turnStackIntoProfile(${i})`,'text')}${button('Copy install script',`copyStack(${i})`,'text')}${button('Edit',`editStack(${i})`,'text')}${button('Edit JSON',`editStackJson(${i})`,'text')}${stack.origin?button('Refresh manifest',`refreshStack(${i})`,'text'):''}${button('Export JSON',`exportStack(${i})`,'text')}${button('Remove stack',`removeStack(${i})`,'text')}</div></article>`).join('')}</div>`:'<div class="empty"><h3>No stacks yet</h3><p class="sub">Combine selected skills from several sources, or import a published manifest. Saving a stack leaves skills uninstalled and profiles unchanged.</p></div>';
  return `<section class="stack-section">${stacks.length&&controls?`<div class="stack-toolbar">${controls}</div>`:''}`+list+'</section>';
}
async function copyStack(index){
  try{const result=await request('stack/script',{id:savedStacks()[index].manifest.id,scope:installScope,agent:installAgent});await copyText(result.script,'Stack install script')}
  catch(error){toast(error.message)}
}
function exportStack(index){
  const manifest=savedStacks()[index].manifest;
  const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=manifest.id+'.json';link.click();URL.revokeObjectURL(url);
}
let stackDraft,stackDialogVersion=0;
function importStack(){
  const version=++stackDialogVersion;
  stackDraft=undefined;
  modal('Import stack',`<p>Paste a manifest or a direct HTTPS link to its JSON. You’ll review its sources and selected skills before saving.</p><fieldset class="profile-source"><legend>Import from</legend><div class="inline"><label class="check"><input type="radio" name="stackInput" value="json" checked onchange="setStackInput('json')"><span>Pasted JSON</span></label><label class="check"><input type="radio" name="stackInput" value="url" onchange="setStackInput('url')"><span>HTTPS URL</span></label></div></fieldset><label id="stackJsonField">Manifest JSON<textarea id="stackJson" rows="10" placeholder='{"version":1,"id":"my-stack","name":"My stack","sources":[...]}'></textarea></label><label id="stackUrlField" hidden>Direct manifest URL<input id="stackUrl" type="url" placeholder="https://raw.githubusercontent.com/owner/repo/main/stack.json"></label><p class="hint">Only the manifest is fetched. No skills are installed or activated.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Review stack',`previewStackInput(${version})`,'primary','id="reviewStack"'));
  stackDraft={mode:'json',version};
}
function setStackInput(mode){stackDraft.mode=mode;$('stackJsonField').hidden=mode!=='json';$('stackUrlField').hidden=mode!=='url';$('stackError').textContent=''}
function stackDialogCurrent(version,body){return version===stackDialogVersion&&$('sheet').open&&(!body||body.isConnected)}
async function previewStackInput(version){
  const draft=stackDraft,control=$('reviewStack'),body=$('sheetContent').firstElementChild;
  control.disabled=true;$('stackError').textContent='';
  try{
    const input=draft.mode==='url'?{origin:$('stackUrl').value.trim()}:{manifest:$('stackJson').value};
    const proposal=await request('stack/preview',input);
    if(!stackDialogCurrent(version,body))return;
    reviewStack(proposal);
  }catch(error){if(stackDialogCurrent(version,body)){$('stackError').textContent=error.message;control.disabled=false}}
}
function stackProfile(stack){return profiles.find(profile=>profile.id==='stack-'+stack.manifest.id)}
function stackProfileGroups(manifest){
  const merged=new Map();
  for(const group of manifest.sources)merged.set(group.source,[...new Set([...(merged.get(group.source)||[]),...group.skills])]);
  return [...merged].map(([source,skills])=>({source,skills}));
}
function stackProfileOutdated(stack,profile=stackProfile(stack)){
  if(!profile)return false;
  const current=profile.groups||[{source:profile.source,skills:profile.skills}];
  return JSON.stringify(current)!==JSON.stringify(stackProfileGroups(stack.manifest));
}
function setStackTarget(profileId,value){selectedTargets[profileId]=value;renderSources();$('stack-scope-'+profileId)?.focus()}
function stackProfilePanel(stack){
  const profile=stackProfile(stack);
  if(!profile)return '';
  const target=selectedTargets[profile.id]||'Global',on=profile.enabled.includes(target);
  const state=profile.enabled.length?`On in ${profile.enabled.map(esc).join(' · ')}`:'Off everywhere';
  const outdated=stackProfileOutdated(stack,profile)?`<span class="status warn">Out of date</span>`:'';
  const toggle=`<button type="button" data-od-id="stack-profile-${esc(profile.id)}-toggle" onclick="activate('${profile.id}')">${on?'Turn off':'Turn on'}</button>`;
  return `<div class="stack-profile"><p class="stack-profile-state"><span class="table-label">Profile</span> <strong>${state}</strong>${outdated}</p><div class="stack-profile-controls"><label class="sr-only" for="stack-scope-${esc(profile.id)}">Scope for ${esc(stack.manifest.name)}</label><select id="stack-scope-${esc(profile.id)}" onchange="setStackTarget('${profile.id}',this.value)">${scopeOptions(target)}</select>${toggle}</div>${outdated&&profile.enabled.length?'<p class="hint">Turn the profile off everywhere, then use Update profile to apply the stack’s picks.</p>':''}</div>`;
}
function stackCollisions(manifest){
  const origins=new Map();
  for(const group of manifest.sources)for(const name of group.skills)origins.set(name,[...new Set([...(origins.get(name)||[]),group.source])]);
  return [...origins].filter(([,sources])=>sources.length>1);
}
function turnStackIntoProfile(index){
  const stack=savedStacks()[index];if(!stack)return;
  const manifest=stack.manifest,linked=stackProfile(stack),collisions=stackCollisions(manifest);
  const total=manifest.sources.reduce((count,group)=>count+group.skills.length,0);
  const plural=(count,word)=>count+' '+word+(count===1?'':'s');
  const blocker=collisions.length?`Each skill can come from only one source. ${collisions.map(([name,sources])=>`${name} is selected from ${sources.join(' and ')}`).join('; ')}. Edit the stack to keep it in one source.`:linked?.enabled.length?`${linked.name} is on in ${linked.enabled.join(', ')}. Turn it off everywhere in Profiles before updating it.`:'';
  modal(linked?'Update profile from stack':'Turn into profile',`<p>${linked?`Replace the members of <strong>${esc(linked.name)}</strong> with this stack’s current picks.`:'Create a profile with this stack’s picks, so you can turn them on or off per Global or project.'}</p><label>Profile name<input id="stackProfileName" maxlength="120" value="${esc(linked?.name||manifest.name)}"></label><p class="meta">${plural(total,'skill')} from ${plural(manifest.sources.length,'source')}</p>${stackGroups(manifest)}<p class="hint">Skills download the first time you turn the profile on. Later stack edits don’t change the profile; use Update profile again.</p><p id="stackError" class="field-error" role="alert">${esc(blocker)}</p>`,button('Cancel','closeModal()','text')+button(linked?'Update profile':'Create profile',`saveStackProfile(${index})`,'primary',`id="saveStackProfile" ${blocker?'disabled':''}`));
}
function saveStackProfile(index){
  const stack=savedStacks()[index],name=$('stackProfileName').value.trim();
  if(!stack)return;
  if(!name){$('stackError').textContent='Name the profile.';return}
  const linked=stackProfile(stack);
  return saveForm(()=>request('profile/save',{stack:stack.manifest.id,name}),linked?'Profile updated. It stays off until you turn it on in Profiles.':'Profile created. Turn it on from Profiles.','stackError');
}
function createStack(){openStackForm()}
function addSourceToStack(index){
  const source=favoriteSources[index],stacks=savedStacks();
  if(!source)return;
  if(!stacks.length){openStackForm(undefined,source.source);return}
  const version=++stackDialogVersion;
  stackDraft={version,focusSource:source.source};
  const options=stacks.map((stack,i)=>{
    const includes=stack.manifest.sources.some(group=>group.source===source.source);
    const notes=[includes?'Already includes this source':'',stack.origin?'Remote · refresh asks before replacing your edits':''].filter(Boolean).join(' · ');
    return `<label class="check"><input type="radio" name="stackTarget" value="${i}"><span>${esc(stack.manifest.name)}${notes?`<span class="hint">${esc(notes)}</span>`:''}</span></label>`;
  }).join('');
  modal('Add '+esc(source.name)+' to a stack',`<p>Choose a stack, then pick which skills from this source to include. You’ll review the change before it’s saved.</p><fieldset class="profile-source"><legend>Stack</legend>${options}<label class="check"><input type="radio" name="stackTarget" value="new"><span>New stack</span></label></fieldset><p class="hint">Nothing is installed or activated.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Choose skills',`continueAddToStack(${version})`,'primary'));
}
function continueAddToStack(version){
  if(!stackDialogCurrent(version))return;
  const choice=document.querySelector('input[name=stackTarget]:checked');
  if(!choice){$('stackError').textContent='Choose a stack or start a new one.';return}
  const source=stackDraft.focusSource;
  openStackForm(choice.value==='new'?undefined:savedStacks()[Number(choice.value)],source);
}
function stackChoiceRow(source,i,checked){
  const count=source.skills.length?source.skills.length+' skills':'No skills selected';
  return `<div class="stack-source-choice"><label class="check"><input type="checkbox" id="stackSource-${i}" data-stack-source="${i}" onchange="stackSourceChanged(${i},this.checked)" ${checked?'checked':''}><span>${esc(source.name)}${source.isNew?' <span class="meta">· New source</span>':''} · <span id="stackSourceCount-${i}">${count}</span></span></label>${button('Choose skills',`chooseStackSkills(${i})`,'text',`id="stackChooseSkills-${i}" aria-expanded="false" aria-controls="stackSkillSelection"`)}</div><div id="stackSkillSlot-${i}"></div>`;
}
function repositoryName(reference){
  const path=reference.trim().replace(/#.*$/,'').replace(/\.git$/,'').replace(/\/+$/,'');
  return path.split(/[/:]/).filter(Boolean).pop()||path;
}
function addStackRepository(){
  const draft=stackDraft,reference=$('stackNewSource').value.trim();
  $('stackError').textContent='';
  if(!validSource(reference)){$('stackError').textContent='Enter a repository URL or owner/repository.';$('stackNewSource').focus();return}
  const existing=draft.choices.findIndex(choice=>sourceKey(choice.source)===sourceKey(reference));
  if(existing>=0){$('stackNewSource').value='';return chooseStackSkills(existing)}
  const index=draft.choices.push({name:repositoryName(reference),source:reference,skills:[],isNew:true})-1;
  $('stackChoices').insertAdjacentHTML('beforeend',stackChoiceRow(draft.choices[index],index,true));
  $('stackNewSource').value='';
  return chooseStackSkills(index);
}
function openStackForm(existing,focusSource){
  const manifest=existing?.manifest;
  const savedSources=manifest?.sources||[];
  const choices=[...savedSources,...favoriteSources.filter(source=>!savedSources.some(saved=>saved.source===source.source))].map(source=>({name:source.name,source:source.source,skills:[...(source.skills||[])]}));
  const version=++stackDialogVersion;
  stackDraft={choices,existing,version,pickers:new Map()};
  modal(existing?'Edit stack':'Create stack',`<p>Name your stack, then select saved sources. Choose specific skills for sources saved as All skills.</p><label>Name<input id="stackName" maxlength="120"></label><label>Identifier<input id="stackId" placeholder="my-stack" maxlength="200"></label><label>Description · optional<input id="stackDescription" maxlength="4000"></label><fieldset class="profile-source"><legend>Source selections</legend><div id="stackChoices">${choices.map((source,i)=>stackChoiceRow(source,i,i<savedSources.length)).join('')}</div><div class="stack-add-source"><label>Add a repository<input id="stackNewSource" placeholder="owner/repository or URL" onkeydown="if(event.key==='Enter'){event.preventDefault();addStackRepository()}"></label>${button('Find skills','addStackRepository()','','id="stackAddRepository"')}</div><p class="hint">A new repository is also saved as a source, with the skills you pick here, when you save the stack.</p></fieldset><div id="stackSkillSelection" class="stack-skill-selection" role="group" hidden><div id="stackDiscovery"></div></div><p class="hint">Selections apply only to this stack. Saved bookmarks stay unchanged. Nothing is installed or activated.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button(existing?'Review changes':'Review stack',`previewNewStack(${version})`,'primary','id="reviewStack"'));
  $('stackName').value=manifest?.name||'';
  $('stackId').value=manifest?.id||'';
  $('stackId').readOnly=Boolean(existing);
  $('stackDescription').value=manifest?.description||'';
  const focus=focusSource===undefined?-1:choices.findIndex(choice=>choice.source===focusSource);
  if(focus>=0){chooseStackSkills(focus);$('stackChooseSkills-'+focus).scrollIntoView?.({block:'center'})}
}
function stackSourceChanged(index,checked){
  if(checked&&(!stackDraft.choices[index].skills.length||stackDraft.pickers.has(index)))return chooseStackSkills(index);
  if(!checked&&stackDraft.activeSource===index){
    $('stackSkillSelection').hidden=true;
    $('stackChooseSkills-'+index).setAttribute('aria-expanded','false');
    stackDraft.activeSource=undefined;
  }
}
async function chooseStackSkills(index){
  const draft=stackDraft,version=draft.version,body=$('sheetContent').firstElementChild;
  const source=draft.choices[index];
  let picker=draft.pickers.get(index);
  $('stackSource-'+index).checked=true;
  if(draft.activeSource!==undefined)$('stackChooseSkills-'+draft.activeSource).setAttribute('aria-expanded','false');
  $('stackSkillSlot-'+index).appendChild($('stackSkillSelection'));
  $('stackChooseSkills-'+index).setAttribute('aria-expanded','true');
  $('stackSkillSelection').hidden=false;$('stackSkillSelection').setAttribute('aria-label',source.name+' skills');$('stackError').textContent='';
  draft.activeSource=index;
  if(picker){renderMembers(picker.names,'Repository skills',false,[...picker.selected],picker.descriptions,picker,picker.paths);return}
  $('stackDiscovery').innerHTML='<p class="hint" role="status">Finding skills…</p>';
  try{
    const result=await request('discover',{source:source.source});
    if(!stackDialogCurrent(version,body)||stackDraft!==draft)return;
    picker={kind:'stack',index,names:result.names,selected:new Set(source.skills),descriptions:result.descriptions||{},paths:result.paths||{}};
    draft.pickers.set(index,picker);
    if(draft.activeSource===index)renderMembers(result.names,'Repository skills',false,source.skills,picker.descriptions,picker,picker.paths);
  }catch(error){if(stackDialogCurrent(version,body)&&draft.activeSource===index){$('stackDiscovery').textContent='';$('stackError').textContent=error.message}}
}
function updateStackSelection(){
  const picker=memberPicker,source=stackDraft.choices[picker.index];
  source.skills=[...picker.selected];
  $('stackSourceCount-'+picker.index).textContent=source.skills.length?source.skills.length+' skills':'No skills selected';
}
async function previewNewStack(version){
  const body=$('sheetContent').firstElementChild;
  const selected=[...document.querySelectorAll('[data-stack-source]:checked')].map(input=>stackDraft.choices[Number(input.dataset.stackSource)]);
  if(selected.some(source=>!source.skills.length)){$('stackError').textContent='Choose at least one skill for each selected source.';return}
  const sources=selected.map(({name,source,skills})=>({name,source,skills}));
  const newSources=selected.filter(source=>source.isNew).map(({name,source,skills})=>({name,source,skills:[...skills]}));
  const existing=stackDraft.existing;
  const manifest={...(existing?.manifest||{version:1}),id:existing?.manifest.id||$('stackId').value.trim(),name:$('stackName').value.trim(),sources};
  const description=$('stackDescription').value.trim();if(description)manifest.description=description;else delete manifest.description;
  try{
    const proposal=await request('stack/preview',existing?{id:existing.manifest.id,manifest}:{manifest});
    if(!stackDialogCurrent(version,body))return;
    if(existing?.origin)proposal.stack.origin=existing.origin;
    reviewStack(proposal,newSources);
  }
  catch(error){if(stackDialogCurrent(version,body))$('stackError').textContent=error.message}
}
function editStack(index){openStackForm(savedStacks()[index])}
function editStackJson(index){
  const existing=savedStacks()[index],version=++stackDialogVersion;
  stackDraft={existing,version};
  modal('Edit stack JSON',`<p>Edit the name, description or selected source groups. The identifier stays ${esc(existing.manifest.id)}. Review your changes before saving.</p><label>Manifest JSON<textarea id="stackJson" rows="14">${esc(JSON.stringify(existing.manifest,null,2))}</textarea></label><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Review changes',`previewStackEdit(${version})`,'primary'));
}
async function previewStackEdit(version){
  const existing=stackDraft.existing,body=$('sheetContent').firstElementChild;
  try{
    const proposal=await request('stack/preview',{id:existing.manifest.id,manifest:$('stackJson').value});
    if(!stackDialogCurrent(version,body))return;
    if(existing.origin)proposal.stack.origin=existing.origin;
    reviewStack(proposal);
  }catch(error){if(stackDialogCurrent(version,body))$('stackError').textContent=error.message}
}
async function refreshStack(index){
  const existing=savedStacks()[index],version=++stackDialogVersion;
  modal('Refresh manifest',`<p>Fetching the proposed selection for ${esc(existing.manifest.name)}…</p><p class="hint">Saved edits remain unchanged until you review and save.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text'));
  const body=$('sheetContent').firstElementChild;
  try{const proposal=await request('stack/preview',{id:existing.manifest.id,origin:existing.origin});if(stackDialogCurrent(version,body))reviewStack(proposal)}
  catch(error){if(stackDialogCurrent(version,body))$('stackError').textContent=error.message}
}
let pendingStackSources=[];
function reviewStack(proposal,newSources=[]){
  ++stackDialogVersion;stackDraft=proposal;pendingStackSources=newSources;
  const {stack,expected}=proposal,manifest=stack.manifest;
  const changed=expected&&JSON.stringify(expected)!==JSON.stringify(stack);
  const current=expected?`<details><summary>Currently saved · ${esc(expected.manifest.name)}</summary>${expected.manifest.description?`<p>${esc(expected.manifest.description)}</p>`:''}${stackGroups(expected.manifest)}</details>`:'';
  modal(expected?'Review stack changes':'Review stack',`<p>${changed?'Saving replaces the complete saved manifest, including local selections. Review both versions below.':expected?'The proposed manifest matches the saved stack.':'Save this install plan to your configuration.'}</p>${current}<section><h3>${expected?'Proposed':'Stack'} · ${esc(manifest.name)}</h3><code>${esc(manifest.id)}</code>${manifest.description?`<p>${esc(manifest.description)}</p>`:''}${stack.origin?`<p class="hint">Refresh origin: ${esc(stack.origin)}</p>`:''}${stackGroups(manifest)}</section>${newSources.length?`<section><h3>New sources</h3><p class="hint">Saved to Sources with the same skills as this stack.</p><ul>${newSources.map(source=>`<li>${esc(source.name)} · <code>${esc(source.source)}</code> · ${source.skills.length} ${source.skills.length===1?'skill':'skills'}</li>`).join('')}</ul></section>`:''}<p class="hint">No skills will be installed or activated. Installed Skills and Profiles stay unchanged.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button(expected?'Save reviewed changes':'Save stack','saveReviewedStack()','primary'));
}
function saveReviewedStack(){
  const proposal=stackDraft,newSources=pendingStackSources,warnings=[];
  sourcesTab='stacks';
  return saveForm(async()=>{
    await request('stack/save',{stack:proposal.stack,expected:proposal.expected});
    const profileError=await syncStackProfile(proposal.stack);
    if(profileError)warnings.push('its profile was not updated: '+profileError+' Use Update profile to retry.');
    if(!newSources.length)return;
    await refresh();
    const known=new Set(currentSettings.favoriteSources.map(source=>sourceKey(source.source)));
    const additions=newSources.filter(source=>!known.has(sourceKey(source.source)));
    if(!additions.length)return;
    try{await savePatch({favoriteSources:[...currentSettings.favoriteSources,...additions]})}
    catch(error){warnings.push('its new sources were not added to Sources: '+error.message)}
  },()=>warnings.length?'The stack was saved, but '+warnings.join('; '):newSources.length?'Stack and new sources saved. No skills installed.':'Stack saved. No skills installed.','stackError');
}
async function syncStackProfile(stack){
  const profile=stackProfile(stack);
  if(!profile||profile.enabled.length||!stackProfileOutdated(stack,profile))return '';
  try{await request('profile/save',{stack:stack.manifest.id,name:profile.name});return ''}
  catch(error){return error.message}
}
function removeStack(index){
  const existing=savedStacks()[index];
  modal('Remove stack?',`<p>Remove ${esc(existing.manifest.name)} from your configuration? Installed skills and profiles remain unchanged.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Remove stack','confirmRemoveStack()'));
  stackDraft={existing};
}
function confirmRemoveStack(){const expected=stackDraft.existing;return saveForm(()=>request('stack/remove',{id:expected.manifest.id,expected}),'Stack removed. Installed skills unchanged.','stackError')}

function stackInstallPlan(manifest,scope){
  const have=new Map((inventories[scope]||[]).map(skill=>[skill.name,skill.available?'on':'off']));
  const groups=manifest.sources.map(group=>({source:group.source,skills:group.skills.map(name=>({name,state:have.get(name)||'missing'}))}));
  const total=groups.reduce((n,group)=>n+group.skills.length,0);
  const missing=groups.reduce((n,group)=>n+group.skills.filter(skill=>skill.state==='missing').length,0);
  return{groups,total,missing,installed:total-missing};
}
function stackInstallSourceCount(target){
  const manifest=savedStacks().find(stack=>stack.manifest.id===target.id).manifest;
  return target.onlyMissing?stackInstallPlan(manifest,target.scope).groups.filter(group=>group.skills.some(skill=>skill.state==='missing')).length:manifest.sources.length;
}
function stackInstallBlocked(){
  const stack=savedStacks().find(item=>item.manifest.id===installationTarget.id);
  return !!installationTarget.onlyMissing&&!!stack&&stackInstallPlan(stack.manifest,installationTarget.scope).missing===0;
}
function setInstallationMode(onlyMissing){
  if(!installationTarget||installationRunning)return;
  installationTarget.onlyMissing=onlyMissing;
  renderStackInstallPlan(false);
}
function renderStackInstallPlan(resetMode){
  const target=installationTarget,host=$('installationPlan'),stack=savedStacks().find(item=>item.manifest.id===target?.id);
  if(!host||!stack)return;
  const plan=stackInstallPlan(stack.manifest,target.scope);
  const offersChoice=plan.installed>0;
  if(resetMode)target.onlyMissing=offersChoice;
  if(!offersChoice)target.onlyMissing=false;
  const onlyMissing=target.onlyMissing,complete=plan.missing===0;
  const plural=(count,word)=>count+' '+word+(count===1?'':'s');
  const groups=plan.groups.map(group=>{
    const runs=!onlyMissing||group.skills.some(skill=>skill.state==='missing');
    const skills=group.skills.map(skill=>{
      const off=skill.state==='off';
      const [kind,mark,label]=skill.state==='missing'?['add','+','Will install']:onlyMissing?['have','✓',off?'Installed · off':'Installed']:['replace','↻',off?'Will replace · turns on':'Will replace'];
      return `<li class="plan-skill is-${kind}"><span class="plan-mark" aria-hidden="true">${mark}</span><span class="plan-name">${esc(skill.name)}</span><span class="plan-tag">${label}</span></li>`;
    }).join('');
    return `<section class="plan-group${runs?'':' is-skipped'}"><h3>${esc(group.source)}${runs?'':' <span class="meta">Skipped · nothing to install</span>'}</h3><ul>${skills}</ul></section>`;
  }).join('');
  const sources=plan.groups.filter(group=>!onlyMissing||group.skills.some(skill=>skill.state==='missing')).length;
  const count=onlyMissing?plan.missing:plan.total;
  let summary=`<strong>${plural(count,'skill')}</strong> from ${plural(sources,'source')} will be added. ${plural(plan.installed,'installed skill')} stay as they are.`;
  if(complete&&onlyMissing)summary=`<strong>Already complete here.</strong> Every skill in this stack is installed in ${esc(target.scope)}.`;
  if(!onlyMissing)summary=`<strong>${plural(count,'skill')}</strong> from ${plural(sources,'source')} will be installed${plan.installed?`, replacing ${plan.installed} that already ${plan.installed===1?'exists':'exist'}`:''}.`;
  host.innerHTML=`<div class="install-plan"><div class="plan-head"><span>${plural(plan.total,'skill')} in this stack</span><span class="meta">${plan.installed} installed · ${plan.missing} missing</span></div>${groups}</div><p class="plan-summary" role="status">${summary}</p>`;
  $('installationOnlyMissing').checked=onlyMissing;
  $('installationAll').checked=!onlyMissing;
  for(const id of ['installationOnlyMissing','installationAll']){$(id).disabled=!offersChoice;$(id).dataset.locked=String(!offersChoice)}
  $('installationMissingHint').textContent=!offersChoice?'Nothing is installed here yet, so everything will be added.':complete?'Nothing is missing here.':`${plural(plan.missing,'skill')} not installed here. Leaves ${plan.installed} untouched.`;
  const start=$('startInstallation');
  if(start){
    start.disabled=installationRunning||complete&&onlyMissing;
    start.textContent=complete&&onlyMissing?'Nothing to install':onlyMissing?'Install '+plural(plan.missing,'missing skill'):offersChoice?'Install all '+plan.total+' skills':'Install '+plural(plan.total,'skill');
  }
}
