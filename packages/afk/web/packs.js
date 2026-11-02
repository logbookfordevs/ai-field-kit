function packGroupList(pack){
  const groups=pack.groups||[{source:pack.source,skills:pack.skills}];
  return groups.map(group=>`<section class="pack-group"><h3>${esc(pack.sourceNames?.[group.source]||repositoryName(group.source))}</h3><code class="path">${esc(group.source)}</code><ul>${group.skills.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></section>`).join('');
}
let packDraft,packDialogVersion=0;
function packDialogCurrent(version,body){return version===packDialogVersion&&$('sheet').open&&(!body||body.isConnected)}
function importPack(){
  const version=++packDialogVersion;
  packDraft={mode:'json',version};
  modal('Import pack',`<p>Paste a manifest or a direct HTTPS link to its JSON. You’ll review its sources and selected skills before saving.</p><fieldset class="profile-source"><legend>Import from</legend><div class="inline"><label class="check"><input type="radio" name="packInput" value="json" checked onchange="setPackInput('json')"><span>Pasted JSON</span></label><label class="check"><input type="radio" name="packInput" value="url" onchange="setPackInput('url')"><span>HTTPS URL</span></label></div></fieldset><label id="packJsonField">Manifest JSON<textarea id="packJson" rows="10" placeholder='{"version":1,"id":"my-pack","name":"My pack","sources":[...]}'></textarea></label><label id="packUrlField" hidden>Direct manifest URL<input id="packUrl" type="url" placeholder="https://raw.githubusercontent.com/owner/repo/main/pack.json"></label><p class="hint">Only the manifest is fetched. No skills are installed or turned on.</p><p id="packError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Review pack',`previewPackInput(${version})`,'primary','id="reviewPack"'));
}
function setPackInput(mode){packDraft.mode=mode;$('packJsonField').hidden=mode!=='json';$('packUrlField').hidden=mode!=='url';$('packError').textContent=''}
async function previewPackInput(version){
  const draft=packDraft,control=$('reviewPack'),body=$('sheetContent').firstElementChild;
  control.disabled=true;$('packError').textContent='';
  try{
    const proposal=await request('pack/import-preview',draft.mode==='url'?{origin:$('packUrl').value.trim()}:{manifest:$('packJson').value});
    if(packDialogCurrent(version,body))reviewPack(proposal);
  }catch(error){if(packDialogCurrent(version,body)){$('packError').textContent=error.message;control.disabled=false}}
}
async function refreshPack(id){
  const pack=profiles.find(item=>item.id===id),version=++packDialogVersion;
  modal('Refresh from its link',`<p>Fetching the latest selection for ${esc(pack.name)}…</p><p class="hint">Nothing changes until you review and save.</p><p id="packError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text'));
  const body=$('sheetContent').firstElementChild;
  try{const proposal=await request('pack/import-preview',{origin:pack.origin});if(packDialogCurrent(version,body))reviewPack(proposal)}
  catch(error){if(packDialogCurrent(version,body))$('packError').textContent=error.message}
}
function reviewPack(proposal){
  ++packDialogVersion;packDraft=proposal;
  const {pack,expected}=proposal,on=expected?.enabled?.length;
  const current=expected?`<details><summary>Currently saved · ${esc(expected.name)}</summary>${packGroupList(expected)}</details>`:'';
  modal(expected?'Review pack changes':'Review pack',`<p>${expected?'Saving replaces this pack’s skills with the version below.':'Save this as a pack in your kit.'}</p>${current}<section><h3>${expected?'Proposed':'Pack'} · ${esc(pack.name)}</h3>${pack.description?`<p>${esc(pack.description)}</p>`:''}${pack.origin?`<p class="hint">From ${esc(pack.origin)}</p>`:''}${packGroupList(pack)}</section><p class="hint">${on?'This pack is on, so it stays on and picks up the changes.':'Nothing is installed or turned on.'}</p><p id="packError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Save pack','saveReviewedPack()','primary'));
}
function saveReviewedPack(){
  const proposal=packDraft;
  return saveForm(()=>request('pack/import',{pack:proposal.pack,expected:proposal.expected}),'Pack saved. No skills installed.','packError');
}
async function exportPack(id){
  try{
    const {manifest}=await request('pack/manifest',{id});
    const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=manifest.id+'.json';link.click();URL.revokeObjectURL(url);
  }catch(error){toast(error.message)}
}
function addSourceToPack(index){
  const source=favoriteSources[index];
  if(!source)return;
  if(!profiles.length){openPackForm(undefined,source.source);return}
  const version=++packDialogVersion;
  packDraft={version,focusSource:source.source};
  const options=[...profiles].sort((a,b)=>byName(a.name,b.name)).map(pack=>{
    const includes=(pack.groups||[{source:pack.source}]).some(group=>group.source===source.source);
    return `<label class="check"><input type="radio" name="packTarget" value="${esc(pack.id)}"><span>${esc(pack.name)}${includes?'<span class="hint">Already includes this source</span>':''}</span></label>`;
  }).join('');
  modal('Add '+esc(source.name)+' to a pack',`<p>Choose a pack, then pick which skills from this source to include.</p><fieldset class="profile-source"><legend>Pack</legend>${options}<label class="check"><input type="radio" name="packTarget" value="new"><span>New pack</span></label></fieldset><p id="packError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Choose skills',`continueAddToPack(${version})`,'primary'));
}
function continueAddToPack(version){
  if(!packDialogCurrent(version))return;
  const choice=document.querySelector('input[name=packTarget]:checked');
  if(!choice){$('packError').textContent='Choose a pack or start a new one.';return}
  openPackForm(choice.value==='new'?undefined:profiles.find(pack=>pack.id===choice.value),packDraft.focusSource);
}
function packChoiceRow(source,i,checked){
  const count=source.skills.length?source.skills.length+' skills':'No skills selected';
  return `<div class="pack-source-choice"><label class="check"><input type="checkbox" id="packSource-${i}" data-pack-source="${i}" onchange="packSourceChanged(${i},this.checked)" ${checked?'checked':''}><span>${esc(source.name)}${source.isNew?' <span class="meta">· New source</span>':''} · <span id="packSourceCount-${i}">${count}</span></span></label>${button('Choose skills',`choosePackSkills(${i})`,'text',`id="packChooseSkills-${i}" aria-expanded="false" aria-controls="packSkillSelection"`)}</div><div id="packSkillSlot-${i}"></div>`;
}
function repositoryName(reference){
  const path=reference.trim().replace(/#.*$/,'').replace(/\.git$/,'').replace(/\/+$/,'');
  return path.split(/[/:]/).filter(Boolean).pop()||path;
}
function addPackRepository(){
  const draft=packDraft,reference=$('packNewSource').value.trim();
  $('packError').textContent='';
  if(!validSource(reference)){$('packError').textContent='Enter a repository URL or owner/repository.';$('packNewSource').focus();return}
  const existing=draft.choices.findIndex(choice=>sourceKey(choice.source)===sourceKey(reference));
  if(existing>=0){$('packNewSource').value='';return choosePackSkills(existing)}
  const index=draft.choices.push({name:repositoryName(reference),source:reference,skills:[],isNew:true})-1;
  $('packChoices').insertAdjacentHTML('beforeend',packChoiceRow(draft.choices[index],index,true));
  $('packNewSource').value='';
  return choosePackSkills(index);
}
function packFormChoices(savedGroups){
  return [...savedGroups,...favoriteSources.filter(source=>!savedGroups.some(saved=>saved.source===source.source))].map(source=>({name:source.name,source:source.source,skills:[...(source.skills||[])]}));
}
function openPackForm(existing,focusSource){
  const saved=existing?(existing.groups||[{source:existing.source,skills:existing.skills}]).filter(group=>group.source!=='Local skill selection').map(group=>({name:existing.sourceNames?.[group.source]||repositoryName(group.source),source:group.source,skills:group.skills})):[];
  const choices=packFormChoices(saved),version=++packDialogVersion;
  packDraft={choices,existing,version,pickers:new Map()};
  modal(existing?'Edit pack':'Create pack',`<p>Name your pack, then choose skills from any of your sources.${existing?.enabled.length?' It’s on, so it stays on and picks up the changes.':''}</p><label>Name<input id="packName" maxlength="120"></label><label>Description · optional<input id="packDescription" maxlength="4000"></label>${packSourcesFields(choices,saved.length)}<p class="hint">Nothing is installed. Skills download when the pack is turned on.</p><p id="packError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Save pack',`savePackForm(${version})`,'primary','id="savePack"'));
  $('packName').value=existing?.name||'';
  $('packDescription').value=existing?.description||'';
  focusPackSource(focusSource);
}
function packSourcesFields(choices,savedCount){
  return `<fieldset class="profile-source"><legend>Sources</legend><div id="packChoices">${choices.map((source,i)=>packChoiceRow(source,i,i<savedCount)).join('')}</div><div class="pack-add-source"><label>Add a repository<input id="packNewSource" placeholder="owner/repository or URL" onkeydown="if(event.key==='Enter'){event.preventDefault();addPackRepository()}"></label>${button('Find skills','addPackRepository()','','id="packAddRepository"')}</div></fieldset><div id="packSkillSelection" class="pack-skill-selection" role="group" hidden><div id="packDiscovery"></div></div>`;
}
function focusPackSource(focusSource){
  const focus=focusSource===undefined?-1:packDraft.choices.findIndex(choice=>choice.source===focusSource);
  if(focus>=0){choosePackSkills(focus);$('packChooseSkills-'+focus).scrollIntoView?.({block:'center'})}
}
function openCoreForm(focusSource){
  const version=++packDialogVersion;
  packDraft={choices:packFormChoices([]),version,pickers:new Map(),core:true};
  modal('Add to Core',`<p>Choose skills that should be on every machine. Installed here on your next sync.</p>${packSourcesFields(packDraft.choices,0)}<p id="packError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Add to Core',`saveCoreForm(${version})`,'primary'));
  focusPackSource(focusSource);
}
function selectedPackSources(){
  return [...document.querySelectorAll('[data-pack-source]:checked')].map(input=>packDraft.choices[Number(input.dataset.packSource)]);
}
function saveCoreForm(version){
  if(!packDialogCurrent(version))return;
  const selected=selectedPackSources();
  if(!selected.length||selected.some(source=>!source.skills.length)){$('packError').textContent='Choose at least one skill for each selected source.';return}
  return saveForm(async()=>{for(const source of selected)await request('kit/add',{names:source.skills,to:'core',source:source.source})},'Added to Core. Sync to install them here.','packError');
}
function savePackForm(version){
  if(!packDialogCurrent(version))return;
  const selected=selectedPackSources(),name=$('packName').value.trim(),existing=packDraft.existing;
  if(!name){$('packError').textContent='Name the pack.';return}
  if(!selected.length||selected.some(source=>!source.skills.length)){$('packError').textContent='Choose at least one skill for each selected source.';return}
  const local=existing?(existing.groups||[{source:existing.source,skills:existing.skills}]).filter(group=>group.source==='Local skill selection'):[];
  const groups=[...selected.map(({source,skills})=>({source,skills})),...local];
  const sourceNames=Object.fromEntries(selected.map(({name,source})=>[source,name]));
  return saveForm(()=>request('pack/save',{...(existing?{id:existing.id}:{}),name,description:$('packDescription').value.trim(),groups,sourceNames}),'Pack saved. No skills installed.','packError');
}
function packSourceChanged(index,checked){
  if(checked&&(!packDraft.choices[index].skills.length||packDraft.pickers.has(index)))return choosePackSkills(index);
  if(!checked&&packDraft.activeSource===index){
    $('packSkillSelection').hidden=true;
    $('packChooseSkills-'+index).setAttribute('aria-expanded','false');
    packDraft.activeSource=undefined;
  }
}
async function choosePackSkills(index){
  const draft=packDraft,version=draft.version,body=$('sheetContent').firstElementChild;
  const source=draft.choices[index];
  let picker=draft.pickers.get(index);
  $('packSource-'+index).checked=true;
  if(draft.activeSource!==undefined)$('packChooseSkills-'+draft.activeSource).setAttribute('aria-expanded','false');
  $('packSkillSlot-'+index).appendChild($('packSkillSelection'));
  $('packChooseSkills-'+index).setAttribute('aria-expanded','true');
  $('packSkillSelection').hidden=false;$('packSkillSelection').setAttribute('aria-label',source.name+' skills');$('packError').textContent='';
  draft.activeSource=index;
  if(picker){renderMembers(picker.names,'Repository skills',false,[...picker.selected],picker.descriptions,picker,picker.paths);return}
  $('packDiscovery').innerHTML='<p class="hint" role="status">Finding skills…</p>';
  try{
    const result=await request('discover',{source:source.source});
    if(!packDialogCurrent(version,body)||packDraft!==draft)return;
    picker={kind:'pack',index,names:result.names,selected:new Set(source.skills),descriptions:result.descriptions||{},paths:result.paths||{}};
    draft.pickers.set(index,picker);
    if(draft.activeSource===index)renderMembers(result.names,'Repository skills',false,source.skills,picker.descriptions,picker,picker.paths);
  }catch(error){if(packDialogCurrent(version,body)&&draft.activeSource===index){$('packDiscovery').textContent='';$('packError').textContent=error.message}}
}
function updatePackSelection(){
  const picker=memberPicker,source=packDraft.choices[picker.index];
  source.skills=[...picker.selected];
  $('packSourceCount-'+picker.index).textContent=source.skills.length?source.skills.length+' skills':'No skills selected';
}
