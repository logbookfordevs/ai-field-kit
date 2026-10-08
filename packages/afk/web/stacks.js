function savedStacks(){return currentSettings.stacks||[]}
function stackGroups(manifest){
  return manifest.sources.map(group=>`<section class="stack-group"><h3>${esc(group.name)}</h3><code class="path">${esc(group.source)}</code><ul>${group.skills.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></section>`).join('');
}
function renderStacks(layout='list'){
  const stacks=savedStacks();
  const list=stacks.length?`<div class="ledger source-collection ${layout==='cards'?'source-gallery':''}">${stacks.map((stack,i)=>`<article class="row source-row"><div class="source-info"><h3>${esc(stack.manifest.name)} <span class="meta">Stack</span></h3>${stack.manifest.description?`<p class="sub">${esc(stack.manifest.description)}</p>`:''}<p class="meta">${stack.manifest.sources.length} sources · ${stack.manifest.sources.reduce((n,g)=>n+g.skills.length,0)} selected skills</p>${stack.origin?`<code class="path">${esc(stack.origin)}</code>`:'<span class="meta">Local manifest</span>'}<details class="source-members"><summary>Skills by source</summary>${stackGroups(stack.manifest)}</details></div><div class="inline">${button('Install',`showInstallation('stack',${i})`)}${button('Copy install script',`copyStack(${i})`,'text')}${button('Edit',`editStack(${i})`,'text')}${button('Edit JSON',`editStackJson(${i})`,'text')}${stack.origin?button('Refresh manifest',`refreshStack(${i})`,'text'):''}${button('Export JSON',`exportStack(${i})`,'text')}${button('Remove stack',`removeStack(${i})`,'text')}</div></article>`).join('')}</div>`:'<div class="empty"><h3>No stacks yet</h3><p class="sub">Combine selected skills from several sources, or import a published manifest. Saving a stack leaves skills uninstalled and profiles unchanged.</p></div>';
  return '<section class="stack-section"><h2>Stacks</h2>'+list+'</section>';
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
function createStack(){openStackForm()}
function openStackForm(existing){
  const manifest=existing?.manifest;
  const savedSources=manifest?.sources||[];
  const choices=[...savedSources,...favoriteSources.filter(source=>!savedSources.some(saved=>saved.source===source.source))].map(source=>({...source,skills:[...(source.skills||[])]}));
  const version=++stackDialogVersion;
  stackDraft={choices,existing,version,pickers:new Map()};
  modal(existing?'Edit stack':'Create stack',`<p>Name your stack, then select saved sources. Choose specific skills for sources saved as All skills.</p><label>Name<input id="stackName" maxlength="120"></label><label>Identifier<input id="stackId" placeholder="my-stack" maxlength="200"></label><label>Description · optional<input id="stackDescription" maxlength="4000"></label><fieldset class="profile-source"><legend>Source selections</legend>${choices.length?choices.map((source,i)=>`<div class="stack-source-choice"><label class="check"><input type="checkbox" id="stackSource-${i}" data-stack-source="${i}" onchange="stackSourceChanged(${i},this.checked)" ${i<savedSources.length?'checked':''}><span>${esc(source.name)} · <span id="stackSourceCount-${i}">${source.skills.length?source.skills.length+' skills':'No skills selected'}</span></span></label>${button('Choose skills',`chooseStackSkills(${i})`,'text',`id="stackChooseSkills-${i}" aria-expanded="false" aria-controls="stackSkillSelection"`)}</div><div id="stackSkillSlot-${i}"></div>`).join(''):'<p class="hint">Save a source first, or import a manifest.</p>'}</fieldset><div id="stackSkillSelection" class="stack-skill-selection" role="group" hidden><div id="stackDiscovery"></div></div><p class="hint">Selections apply only to this stack. Saved bookmarks stay unchanged. Nothing is installed or activated.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button(existing?'Review changes':'Review stack',`previewNewStack(${version})`,'primary','id="reviewStack"'));
  $('stackName').value=manifest?.name||'';
  $('stackId').value=manifest?.id||'';
  $('stackId').readOnly=Boolean(existing);
  $('stackDescription').value=manifest?.description||'';
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
  const sources=[...document.querySelectorAll('[data-stack-source]:checked')].map(input=>stackDraft.choices[Number(input.dataset.stackSource)]);
  if(sources.some(source=>!source.skills.length)){$('stackError').textContent='Choose at least one skill for each selected source.';return}
  const existing=stackDraft.existing;
  const manifest={...(existing?.manifest||{version:1}),id:existing?.manifest.id||$('stackId').value.trim(),name:$('stackName').value.trim(),sources};
  const description=$('stackDescription').value.trim();if(description)manifest.description=description;else delete manifest.description;
  try{
    const proposal=await request('stack/preview',existing?{id:existing.manifest.id,manifest}:{manifest});
    if(!stackDialogCurrent(version,body))return;
    if(existing?.origin)proposal.stack.origin=existing.origin;
    reviewStack(proposal);
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
function reviewStack(proposal){
  ++stackDialogVersion;stackDraft=proposal;
  const {stack,expected}=proposal,manifest=stack.manifest;
  const changed=expected&&JSON.stringify(expected)!==JSON.stringify(stack);
  const current=expected?`<details><summary>Currently saved · ${esc(expected.manifest.name)}</summary>${expected.manifest.description?`<p>${esc(expected.manifest.description)}</p>`:''}${stackGroups(expected.manifest)}</details>`:'';
  modal(expected?'Review stack changes':'Review stack',`<p>${changed?'Saving replaces the complete saved manifest, including local selections. Review both versions below.':expected?'The proposed manifest matches the saved stack.':'Save this install plan to your configuration.'}</p>${current}<section><h3>${expected?'Proposed':'Stack'} · ${esc(manifest.name)}</h3><code>${esc(manifest.id)}</code>${manifest.description?`<p>${esc(manifest.description)}</p>`:''}${stack.origin?`<p class="hint">Refresh origin: ${esc(stack.origin)}</p>`:''}${stackGroups(manifest)}</section><p class="hint">No skills will be installed or activated. Installed Skills and Profiles stay unchanged.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button(expected?'Save reviewed changes':'Save stack','saveReviewedStack()','primary'));
}
function saveReviewedStack(){const proposal=stackDraft;return saveForm(()=>request('stack/save',proposal),'Stack saved. No skills installed.','stackError')}
function removeStack(index){
  const existing=savedStacks()[index];
  modal('Remove stack?',`<p>Remove ${esc(existing.manifest.name)} from your configuration? Installed skills and profiles remain unchanged.</p><p id="stackError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Remove stack','confirmRemoveStack()'));
  stackDraft={existing};
}
function confirmRemoveStack(){const expected=stackDraft.existing;return saveForm(()=>request('stack/remove',{id:expected.manifest.id,expected}),'Stack removed. Installed skills unchanged.','stackError')}
