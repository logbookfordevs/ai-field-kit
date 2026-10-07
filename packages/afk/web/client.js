let currentSettings, inventories={}, skillSharing={}, afkHome='',toolRuns={};
async function request(path,data){
  const response=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:{'X-AFK-Token':window.afkToken,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Operation failed.');
  return result;
}
async function refresh(){
  const state=await request('state');
  currentSettings=state.settings;inventories=state.inventories;skillSharing=state.skillSharing||{};settingsPath=state.settingsPath;afkHome=state.home;
  ({profiles,projects,tools,favoriteSources,preferences}=currentSettings);
  toolRuns=state.toolRuns||{};
  tools=tools.map(tool=>({...tool,last:toolRuns[tool.id]?{ok:toolRuns[tool.id].code===0,label:toolRuns[tool.id].pending?'Running…':'Last run · exit '+toolRuns[tool.id].code}:null}));
  await loadRules();
  render();
}
async function operation(action){
  try{await action();await refresh()}
  catch(error){await refresh().catch(()=>{});toast(error.message);console.error(error)}
}
async function persist(){
  const settings={...currentSettings,projects,tools:tools.map(({last,...tool})=>tool),favoriteSources,preferences};
  await request('settings',{settings});
}
inventory=()=>inventories[scope]||[];
isAvailable=entry=>entry.available;
activate=id=>operation(async()=>{
  const profile=profiles.find(p=>p.id===id),target=selectedTargets[id]||'Global';
  if(!profile.enabled.includes(target)&&!profile.ready)toast('Preparing missing profile members before enabling…');
  await request('activation',{id,scope:target,enabled:!profile.enabled.includes(target)});
});
toggleSkill=name=>operation(()=>request('skill/toggle',{name,scope}));
inspectSkill=async(name,fromProfile,file='SKILL.md')=>{
  try{
    const selectedScope=fromProfile?'Global':scope;
    const data=await request('skill/read',{name,scope:selectedScope,file});
    inspectedSkill={name,scope:selectedScope,file,content:data.content};
    modal(esc(name),`<p class="path">${esc(data.path)}</p><label>Skill file<select id="previewFile">${data.files.map(path=>`<option ${path===file?'selected':''}>${esc(path)}</option>`).join('')}</select></label><div id="skillTokenDetails">${button('Show token usage estimation','showSkillTokenEstimate()','text')}</div><pre>${esc(data.content)}</pre>`,'','Skill instructions');
    $('previewFile').onchange=event=>inspectSkill(name,fromProfile,event.target.value);
  }catch(error){toast(error.message)}
};
invoke=async id=>{
  try{
    const profile=profiles.find(p=>p.id===id),data=await request('profile/read',{id});
    modal('Use '+esc(profile.name)+' with your agent',`<p>Ask your agent to run this command and read its output. Nothing is enabled.</p><label>AFK command<span class="inline"><input id="invocationCommand" readonly value="afk profiles use ${esc(id)}">${button('Copy command','copyCommand()','primary')}</span></label><details><summary>Preview group instructions</summary><pre>${esc(data.content)}</pre></details>`);
  }catch(error){toast(error.message)}
};
async function saveForm(action,message,errorId){
  const form=$('sheetContent').firstElementChild,buttons=[...$('sheetContent').querySelectorAll('button')];
  buttons.forEach(button=>button.disabled=true);
  try{await action();if(form.isConnected)closeModal();await refresh();toast(message)}
  catch(error){if(form.isConnected){const field=$(errorId);if(field)field.textContent=error.message;else toast(error.message)}else toast(error.message)}
  finally{if(form.isConnected)buttons.forEach(button=>button.disabled=false)}
}
async function savePatch(patch){await request('settings',{settings:{...currentSettings,...patch}})}
saveTool=id=>{
  const name=$('toolName').value.trim(),install=$('installCmd').value.trim(),update=$('updateCmd').value.trim();
  if(!name||!install){$('toolError').textContent=!name?'Name the tool.':'Add an install command.';return}
  const next=currentSettings.tools.filter(tool=>tool.id!==id).concat({id:id||Date.now(),name,install,update});
  return saveForm(()=>savePatch({tools:next}),'Tool saved. No command executed.','toolError');
};
removeTool=id=>operation(async()=>{await savePatch({tools:currentSettings.tools.filter(tool=>tool.id!==id)});toast('Entry removed. Installed tool unchanged.')});
let toolBatch;
function runAllTools(update){
  if(!toolBatch?.pending)toolBatch={update,pending:false,started:false,items:tools.map(tool=>({id:tool.id,name:tool.name,command:update?(tool.update||tool.install):tool.install,status:'Waiting',output:''}))};
  const batch=toolBatch;
  modal(batch.update?'Update all tools':'Install all tools',`<p>Run ${batch.items.length} saved commands, one at a time, from your home folder. Failed commands do not stop the remaining tools. Closing this dialog leaves the batch running.</p><p class="path">Working folder: ${esc(afkHome)}</p><div id="toolBatchOutput" role="status" aria-live="polite"></div>`,button('Close','closeModal()','text')+button('Run all commands','executeToolBatch()','primary','id="startToolBatch"'));
  renderToolBatch();
}
function renderToolBatch(){
  const output=$('toolBatchOutput');if(!output||!toolBatch)return;
  const batch=toolBatch,completed=batch.items.filter(item=>item.code!==undefined).length;
  output.innerHTML=`<p>${batch.pending?'Running':batch.started?'Finished':'Ready'} · ${completed} of ${batch.items.length} completed</p>${batch.items.map(item=>`<section><h3>${esc(item.name)} · ${esc(item.status)}</h3><pre>$ ${esc(item.command)}</pre>${item.output?`<pre>${esc(item.output)}</pre>`:''}</section>`).join('')}`;
  const control=$('startToolBatch');if(control){control.disabled=batch.pending||batch.started||!batch.items.length;control.textContent=batch.pending?'Running…':batch.started?'Finished':'Run all commands';}
}
async function executeToolBatch(){
  const batch=toolBatch;if(!batch||batch.pending||batch.started)return;
  batch.pending=true;batch.started=true;renderToolBatch();
  for(const item of batch.items){
    if(toolRuns[item.id]?.pending){item.status='Skipped · already running';item.code=1;renderToolBatch();continue}
    item.status='Running…';toolRuns[item.id]={pending:true,output:'Running…'};
    tools=tools.map(tool=>tool.id===item.id?{...tool,last:{ok:false,label:'Running…'}}:tool);
    if(section==='Tools')renderTools();renderToolBatch();
    try{const result=await request('tool/run',{id:item.id,update:batch.update});item.code=result.code;item.output=result.output;item.status=result.code===0?'Complete':'Failed · exit '+result.code;toolRuns[item.id]={pending:false,...result}}
    catch(error){item.code=1;item.output=error.message;item.status='Failed';toolRuns[item.id]={pending:false,code:1,output:error.message}}
    tools=tools.map(tool=>tool.id===item.id?{...tool,last:{ok:item.code===0,label:'Last run · exit '+item.code}}:tool);
    if(section==='Tools')renderTools();renderToolBatch();
  }
  batch.pending=false;renderToolBatch();
  await refresh().catch(error=>toast(error.message));
  const failed=batch.items.filter(item=>item.code!==0).length;
  toast(failed?`Batch finished. ${failed} tools failed or were skipped.`:'All tool commands completed.');
}
runTool=(id,update)=>{
  const tool=tools.find(tool=>tool.id===id),command=update?(tool.update||tool.install):tool.install;
  window.selectedRun={id,update};
  modal((update?'Update ':'Install ')+esc(tool.name),`<pre>$ ${esc(command)}</pre><p class="path">Working folder: ${esc(afkHome)}</p><div id="runOutput" data-tool-id="${id}" role="status"></div>`,button('Close','closeModal()','text')+button('Run command','executeDemo()','primary'));
  showRun(id);
};
function showRun(id){
  const output=$('runOutput');if(!output||Number(output.dataset.toolId)!==id)return;
  const run=toolRuns[id],control=$('sheetContent').querySelector('.primary');
  output.innerHTML=run?`<pre>${esc(run.output)}${run.pending?'':'\nExit '+run.code}</pre>`:'<p>Ready to run this saved command.</p>';
  control.disabled=Boolean(run?.pending);control.textContent=run?.pending?'Running…':run?'Run again':'Run command';
}
executeDemo=async()=>{
  const run={...window.selectedRun};
  if(toolRuns[run.id]?.pending)return;
  toolRuns[run.id]={pending:true,output:'Running…'};
  tools=tools.map(tool=>tool.id===run.id?{...tool,last:{ok:false,label:'Running…'}}:tool);
  if(section==='Tools')renderTools();showRun(run.id);
  try{const result=await request('tool/run',run);toolRuns[run.id]={pending:false,...result}}
  catch(error){toolRuns[run.id]={pending:false,code:1,output:error.message}}
  finally{showRun(run.id);await refresh()}
};
browse=mode=>{browseMode=mode;folder=afkHome;folderModal()};
folderModal=async()=>{
  try{
    const data=await request('folders',{path:folder});folder=data.path;
    const parts=folder.split('/').filter(Boolean);
    const ancestors=[{name:'/',path:'/'}];parts.forEach((name,index)=>ancestors.push({name,path:'/'+parts.slice(0,index+1).join('/')}));
    modal('Choose '+(browseMode==='project'?'project folder':'AFK folder'),`<div class="folder-path">${button('Parent',`chooseFolder(${JSON.stringify(data.parent).replaceAll('"','&quot;')})`,'',data.parent===folder?'disabled':'')}<nav aria-label="Folder breadcrumbs" class="folder-crumbs">${ancestors.map((part,index)=>`<button type="button" class="text" data-ancestor="${index}" ${part.path===folder?'aria-current="location"':''}>${esc(part.name)}</button>`).join('<span aria-hidden="true">/</span>')}</nav></div>${browseMode==='settings'?`<p class="hint">${data.settings?'Existing AFK folder · settings.json found. Select it to load its configuration.':'Navigate to your preferred folder. Move your AFK files here or create a dedicated subfolder.'}</p><ul class="folder-files">${(data.files||[]).filter(name=>name==='settings.json'||name==='AGENTS.md').map(name=>`<li><code>${esc(name)}</code></li>`).join('')}</ul>`:''}<div class="list">${data.folders.map((name,index)=>`<button type="button" class="folder" data-folder-index="${index}"><span>${esc(name)}</span><span aria-hidden="true">›</span></button>`).join('')||'<p>No subfolders.</p>'}</div>`,button('Cancel','closeModal()','text')+(browseMode==='settings'?(data.settings?button('Load this AFK folder',`workspaceReview('select',${esc(JSON.stringify(folder))})`,'primary'):button('Create AFK folder here','newWorkspaceFolder()')+button('Move into this folder',`workspaceReview('move',${esc(JSON.stringify(folder))})`,'primary')):button('Use this folder','useFolder()','primary')));
    document.querySelectorAll('[data-ancestor]').forEach(element=>element.onclick=()=>chooseFolder(ancestors[Number(element.dataset.ancestor)].path));
    document.querySelectorAll('[data-folder-index]').forEach(element=>element.onclick=()=>chooseFolder(folder+'/'+data.folders[Number(element.dataset.folderIndex)]));
  }catch(error){toast(error.message)}
};
function chooseFolder(path){folder=path;folderModal()}
const originalUseFolder=useFolder;
useFolder=()=>{
  if(browseMode==='settings'){workspaceReview('move',folder);return}
  originalUseFolder();
};
saveProject=()=>{
  const name=$('projectName').value.trim();
  if(!name||projects.some(project=>project.name===name)){toast('Choose a unique project name.');return}
  return saveForm(()=>request('project/save',{name,path:folder}),'Project saved. Profile activation unchanged.','projectError');
};
configuration=()=>structuredClone(currentSettings);
exportSettings=()=>{
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(configuration(),null,2)],{type:'application/json'}));a.download='settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
showNotes=()=>modal('AFK — Fieldwork','<p>Your local workspace for skills, shared profiles, favorite sources, global tool commands, and shared agent rules.</p><p class="sub">Settings and rule files live together in the AFK folder you choose. Source controls copy installation commands; skill updates run here and preserve availability.</p>',button('Show Welcome','showWelcome()'));
refresh().then(maybeWelcome).catch(error=>{$('view').innerHTML=`<div class="error" role="alert">${esc(error.message)}</div>`});
discover=async()=>{
  const picker=profilePicker,source=$('source').value.trim(),version=++picker.version;
  const isCurrent=()=>profilePicker===picker&&version===picker.version&&$('sheet').open&&Boolean($('discoverMembers'));
  if(!source){$('profileError').textContent='Enter a repository to find its skills.';$('source').focus();return}
  $('profileError').textContent='';$('discovery').innerHTML='<p role="status">Finding skills in this repository…</p>';$('saveProfile').disabled=true;$('discoverMembers').disabled=true;
  try{const result=await request('discover',{source});if(!isCurrent())return;renderMembers(result.names,'Repository skills',false,picker.selectAllOnDiscovery?result.names:[],result.descriptions||{},picker,result.paths||{})}
  catch(error){if(isCurrent())$('discovery').innerHTML=`<div class="error" role="alert">${esc(error.message)}</div>`}
  finally{if(isCurrent())$('discoverMembers').disabled=false}
};
saveProfile=async()=>{
  const name=$('profileName').value.trim(),skills=[...profilePicker.selected],source=profilePicker.mode==='local'?'Local skill selection':$('source').value.trim();
  if(!name){$('nameError').textContent='Name this profile.';$('profileName').setAttribute('aria-invalid','true');$('profileName').focus();return}
  const form=$('sheetContent').firstElementChild,control=$('saveProfile');control.disabled=true;control.textContent=profilePicker.mode==='local'?'Saving…':'Preparing…';$('profileError').textContent='';
  try{await request('profile/save',{id:editing?.id,name,skills,source});if(form.isConnected)closeModal();await refresh();toast('Profile saved. Activation stays unchanged.')}
  catch(error){if(form.isConnected){$('profileError').textContent=error.message;control.disabled=false;control.textContent='Save profile'}else toast(error.message)}
};

removeProfile=id=>operation(async()=>{await request('profile/remove',{id});closeModal()});
retryPreparation=id=>operation(async()=>{const {name,source,skills}=profiles.find(p=>p.id===id);await request('profile/save',{id,name,source,skills})});
setPreference=(name,mode)=>operation(()=>request('invocation',{name,scope,mode}));
importSettings=async file=>{
  $('importFile').value='';if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(data.version!==1||!Array.isArray(data.projects))throw Error('Choose an AFK settings version 1 export.');
    window.pendingImport=data;
    modal('Review imported configuration',`<p>Remap project folders for this machine. Import leaves profiles inactive until you prepare them.</p>${data.projects.map((project,index)=>`<label>${esc(project.name)}<input class="remap" data-index="${index}" value="${esc(project.path)}"></label>`).join('')}`,button('Cancel','closeModal()','text')+button('Import configuration','applyImport()','primary'));
  }catch(error){toast(error.message)}
};
applyImport=()=>operation(async()=>{
  const settings=window.pendingImport;
  settings.projects=settings.projects.map((project,index)=>({...project,path:document.querySelectorAll('.remap')[index].value}));
  await request('import',{settings});closeModal();scope='Global';selectedTargets={};
});
editProject=index=>{
  const project=projects[index];
  modal('Edit project',`<label>Name<input id="projectName" value="${esc(project.name)}"></label><label>Folder<input id="projectPath" value="${esc(project.path)}"></label><p class="hint">Disable this project's profiles before changing its folder.</p>`,button('Cancel','closeModal()','text')+button('Save project',`renameProject(${index})`,'primary'));
};
renameProject=index=>operation(async()=>{
  await request('project/save',{previous:projects[index].name,name:$('projectName').value.trim(),path:$('projectPath').value.trim()});closeModal();
});
window.exitAfk=async()=>{
  const exits=[...document.querySelectorAll('[data-exit]')];
  exits.forEach(exit=>{exit.disabled=true;exit.textContent='Exiting…'});
  try{
    await request('exit',{});
    savedRuleSnapshot=draftSnapshot();
    if($('sheet').open)closeModal();
    $('nav').replaceChildren();
    $('crumb').textContent='Closed';
    $('view').innerHTML='<h1 tabindex="-1" id="closedTitle">AFK is closed</h1><p>The local server has stopped accepting connections. Your configuration and enabled skills are unchanged.</p><p>You can close this tab. Start AFK from your terminal to open it again.</p>';
    exits.forEach(exit=>exit.textContent='Closed');$('mobileSection').disabled=true;
    $('closedTitle').focus();
  }catch(error){
    exits.forEach(exit=>{exit.disabled=false;exit.textContent='Exit AFK'});toast(error.message);
  }
};

const stopAfkService=window.exitAfk;
window.exitAfk=()=>{
  if(!hasRuleEdits())return stopAfkService();
  modal('Exit with unsaved rule drafts?', '<p>Your drafts have not been saved to the AFK folder. Save them before exiting to keep your changes.</p>',button('Keep AFK open','closeModal()','text')+button('Discard drafts &amp; exit','stopAfkService()','primary'));
};

let skillDeletionPreview;
async function reviewSkillDeletion(name){
  skillDeletionPreview=undefined;
  try{
    const preview=await request('skill/delete-preview',{name,scope});
    skillDeletionPreview=preview;
    modal('Delete '+esc(name)+'?',`<p>This permanently deletes this skill copy and all its supporting files from ${esc(preview.scope)} storage. You can reinstall it later from its source.</p><p class="path">${esc(preview.path)}</p>${preview.available?'<p>This skill is available now. Deleting it also removes its availability in this scope.</p>':''}${preview.retainedCopies.length?`<p>Another copy will remain and may still appear in Installed Skills:</p><ul>${preview.retainedCopies.map(path=>`<li class="path">${esc(path)}</li>`).join('')}</ul>`:''}${preview.claudeSharesStorage?'<p>Claude shares this skills folder, so this deletion affects Claude too.</p>':''}${preview.copies.length?`<p>This separate Claude copy and all its supporting files will also be permanently deleted:</p><ul>${preview.copies.map(copy=>`<li class="path">${esc(copy.path)}</li>`).join('')}</ul>`:''}${preview.links.length?`<p>These availability links will also be removed (their targets are only deleted if listed above):</p><ul>${preview.links.map(link=>`<li class="path">${esc(link.path)}</li>`).join('')}</ul>`:''}<p id="deleteSkillError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()')+button('Delete permanently','finishSkillDeletion()','text danger'));
  }catch(error){toast(error.message)}
}
async function finishSkillDeletion(){
  const preview=skillDeletionPreview;
  if(!preview)return;
  await saveForm(()=>request('skill/delete',{name:preview.name,scope:preview.scope,expected:preview,confirmed:true}),'Selected skill copy permanently deleted.','deleteSkillError');
}

let claudeSharingReview;
async function reviewClaudeSharing(){
  claudeSharingReview=undefined;
  try{
    const state=await request('skills-sharing/state',{scope});
    claudeSharingReview=state;
    const connected=state.status==='connected',conflict=state.status==='conflict';
    const status=connected?'Sharing is on':conflict?'Existing folder needs attention':'Sharing is off';
    const effect=connected?'Disconnecting removes only the folder link. Your skills stay in the canonical folder, but Claude will no longer discover them through this path.':"Sharing lets Claude see the same available skills. Missing folders are created automatically. An empty Claude skills folder can be replaced; existing skills are never overwritten.";
    modal('Share skills with Claude',`<p><strong>${esc(status)} · ${esc(state.scope)}</strong></p><p>${esc(effect)}</p><label>Shared skills folder<span class="path">${esc(state.source)}</span></label><label>Claude folder<span class="path">${esc(state.destination)}</span></label>${conflict?`<p class="error">${esc(state.reason)}</p>`:''}<p id="sharingError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()')+(conflict?'':button(connected?'Disconnect sharing':'Enable sharing',`applyClaudeSharing(${!connected})`,connected?'text danger':'primary')));
  }catch(error){toast(error.message)}
}
async function applyClaudeSharing(enabled){
  const expected=claudeSharingReview;
  if(!expected)return;
  await saveForm(()=>request('skills-sharing/set',{scope:expected.scope,enabled,expected}),enabled?'Claude now shares this skills folder.':'Claude folder sharing disconnected. Skills preserved.','sharingError');
}

let selectedSkills=new Set(),selectedSkillScope='Global',skillBulkBusy=false,bulkDeleteReview;
function selectSkill(name,selected){if(selected)selectedSkills.add(name);else selectedSkills.delete(name);renderSkillList();document.querySelector(`[data-skill-select="${name}"]`)?.focus()}
function selectShownSkills(){for(const skill of inventory())if(matchesSkillFilters(skill))selectedSkills.add(skill.name);renderSkillList()}
function clearSkillSelection(){selectedSkills.clear();renderSkillList()}
function renderSkillSelection(shown){
  if($('scopeSelect'))$('scopeSelect').disabled=skillBulkBusy;
  const hidden=[...selectedSkills].filter(name=>!shown.some(skill=>skill.name===name)).length;
  const disabled=skillBulkBusy?'disabled':'';
  const count=selectedSkills.size;
  $('skillSelection').innerHTML=count?`<div class="skill-bulk" role="group" aria-label="Selected skill actions"><strong class="bulk-count">${count} selected${skillBulkBusy?' · Applying…':''}${hidden?' · '+hidden+' hidden by filters':''} · ${esc(scope)}</strong>${button('Enable',"applySkillBulk('enable')",'',disabled)}${button('Disable',"applySkillBulk('disable')",'',disabled)}<label><span class="sr-only">Invocation for selected skills</span><select ${disabled} aria-label="Invocation for selected skills" onchange="if(this.value)applySkillBulk('invocation',this.value==='default'?'':this.value)"><option value="">Change invocation…</option><option>Manual only</option><option>Automatic allowed</option><option value="default">Restore defaults</option></select></label>${button('Delete selected','reviewBulkSkillDeletion()','text danger',disabled)}${button('Clear selection','clearSkillSelection()','text',disabled)}</div>`:'';
  if(shown.length)$('skillSelection').innerHTML+=`<p>${button('Select shown','selectShownSkills()','text',disabled)}</p>`;
}
function showSkillBulkResult(result,target){
  if(result.failed&&selectedSkillScope===target)for(const item of result.items)if(item.ok)selectedSkills.delete(item.name);
  if(result.failed){modal('Some skills could not be changed',`<p>${result.completed} completed · ${result.failed} failed · ${esc(target)}. Completed changes are kept. Failed skills stay selected.</p><ul>${result.items.filter(item=>!item.ok).map(item=>`<li><strong>${esc(item.name)}</strong><p>${esc(item.error)}</p></li>`).join('')}</ul>`,button('Close','closeModal()'))}
  else toast(`${result.completed} skills updated in ${target}.`);
}
async function applySkillBulk(action,mode){
  if(skillBulkBusy||!selectedSkills.size)return;
  const target=scope,names=[...selectedSkills];skillBulkBusy=true;renderSkillList();
  try{const result=await request('skills/bulk',{names,scope:target,action,...(action==='invocation'?{mode}:{})});showSkillBulkResult(result,target);await refresh()}
  catch(error){toast(error.message);await refresh().catch(()=>{})}
  finally{skillBulkBusy=false;if($('skillList'))renderSkillList()}
}
async function reviewBulkSkillDeletion(){
  if(skillBulkBusy||!selectedSkills.size)return;
  const target=scope,names=[...selectedSkills];
  skillBulkBusy=true;bulkDeleteReview=undefined;renderSkillList();
  modal('Review selected deletions',`<p role="status">Checking ${names.length} selected skills in ${esc(target)} and their storage links…</p><p>You can close this review while the checks finish.</p>`,button('Close','closeModal()'));
  const loadingPanel=$('sheetContent').firstElementChild;
  try{
    const review=await request('skills/delete-preview',{names,scope:target});
    if(!$('sheet').open||$('sheetContent').firstElementChild!==loadingPanel)return;
    bulkDeleteReview=review;
    const eligible=review.items.filter(item=>item.preview);
    modal('Delete selected skills?',`<p>Permanently delete ${eligible.length} ${eligible.length===1?'skill copy':'skill copies'} in ${esc(review.scope)} and their listed supporting files, Claude copies and links. ${review.items.length-eligible.length} blocked ${review.items.length-eligible.length===1?'skill':'skills'} will be kept.</p>${review.items.map(item=>item.preview?`<details><summary>${esc(item.name)}</summary><p class="path">${esc(item.preview.path)}</p>${item.preview.copies.map(copy=>`<p class="path">Claude copy: ${esc(copy.path)}</p>`).join('')}${item.preview.links.map(link=>`<p class="path">Remove link: ${esc(link.path)}</p>`).join('')}${item.preview.claudeSharesStorage?'<p>Claude shares this folder; deletion affects both.</p>':''}${item.preview.retainedCopies.map(path=>`<p class="path">Keep other copy: ${esc(path)}</p>`).join('')}</details>`:`<p><strong>${esc(item.name)} is blocked:</strong> ${esc(item.error)}</p>`).join('')}<p id="bulkDeleteError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()')+button(`Delete ${eligible.length} permanently`,'finishBulkSkillDeletion()','text danger',eligible.length?'':'disabled'));
  }catch(error){
    if($('sheet').open&&$('sheetContent').firstElementChild===loadingPanel)modal('Could not review deletions',`<p role="alert">${esc(error.message)}</p>`,button('Close','closeModal()'));
    else toast(error.message);
  }finally{skillBulkBusy=false;if($('skillList'))renderSkillList()}
}
async function finishBulkSkillDeletion(){
  if(skillBulkBusy||!bulkDeleteReview)return;
  const review=bulkDeleteReview;skillBulkBusy=true;let result;
  try{
    await saveForm(async()=>{result=await request('skills/bulk',{names:review.names,scope:review.scope,action:'delete',expected:review,confirmed:true});for(const item of result.items)if(item.ok)selectedSkills.delete(item.name)},'Reviewed skills deleted.','bulkDeleteError');
    if(result?.failed)showSkillBulkResult(result,review.scope);
  }finally{skillBulkBusy=false;if($('skillList'))renderSkillList()}
}

let skillUpdateRunning=false,skillUpdateNames;
showSkillUpdate=(name)=>{
  skillUpdateNames=name?[name]:undefined;
  modal(name?'Update '+esc(name):'Update skills',`<p>Update ${name?esc(name):'tracked skills'} in ${esc(scope)} through Skills CLI. Available skills stay available; disabled skills stay disabled. Your AFK invocation preferences are kept.</p><p class="hint">Updates are prepared separately before replacing stored files.</p><div id="skillUpdateOutput" role="status" aria-live="polite"></div>`,button('Close','closeModal()','text')+button(skillUpdateRunning?'View progress':'Update skills','executeSkillUpdate()', 'primary'));
  pollSkillUpdate();
};
function renderSkillUpdate(result){
  const output=$('skillUpdateOutput');if(!output||!result)return;
  if(result.scope!==scope&&!result.pending&&output.dataset.jobScope!==result.scope)return;output.dataset.jobScope=result.scope;
  const signature=JSON.stringify(result);if(output.dataset.updateSignature===signature)return;output.dataset.updateSignature=signature;
  const stage=result.code? -1:result.phase.startsWith('Preparing')?0:result.phase.startsWith('Updating through')?1:2;
  const stages=['Prepare','Update','Apply'];
  const steps=stages.map((label,index)=>`<li class="${result.code===0||index<stage?'complete':index===stage?'current':''}"><span>${result.code===0||index<stage?'✓':index+1}</span>${label}</li>`).join('');
  if(!output.querySelector('[data-update-summary]'))output.innerHTML='<div data-update-summary></div><details><summary>Skills CLI output</summary><pre></pre></details><p><button type="button" class="text danger" data-cancel-update onclick="cancelSkillUpdate()">Cancel update</button></p>';
  output.querySelector('[data-update-summary]').innerHTML=`<p class="meta">${esc(result.scope)} update${result.names?' · '+esc(result.names.join(', ')):''}</p><ol class="update-steps" aria-label="Update stages">${steps}</ol><p class="update-phase">${result.pending?'<span class="update-spinner" aria-hidden="true"></span>':''}<strong>${esc(result.phase)}</strong></p>${result.updated!==undefined?`<p>${result.updated} stored ${result.updated===1?'skill':'skills'} updated. Availability preserved.</p>`:''}`;
  output.querySelector('pre').textContent=result.output||'Preparing…';
  const cancel=output.querySelector('[data-cancel-update]');cancel.hidden=!result.pending;cancel.disabled=!result.cancellable;cancel.textContent=result.cancellable?'Cancel update':'Finishing safely…';
}
async function pollSkillUpdate(){try{const result=await request('skills/update-state',{});renderSkillUpdate(result);if(result?.pending){skillUpdateRunning=true;if($('skillUpdateOutput'))setTimeout(pollSkillUpdate,1000)}else if(result)skillUpdateRunning=false}catch{} }
executeSkillUpdate=async()=>{
  if(skillUpdateRunning){await pollSkillUpdate();return}
  const target=scope,names=skillUpdateNames;skillUpdateRunning=true;
  renderSkillUpdate({scope:target,pending:true,cancellable:true,phase:'Preparing isolated update…',output:''});
  const foot=$('sheetContent').querySelector('.dialog-foot');if(foot)foot.innerHTML=button('Close','closeModal()','text');
  const timer=setTimeout(pollSkillUpdate,1000);
  try{const result=await request('skills/update',{scope:target,...(names?{names}:{})});renderSkillUpdate(result);await refresh();toast(result.cancelled?'Update cancelled. Original skills unchanged.':result.code===0?'Skills updated. Availability preserved.':'Update failed. Open update details.');}
  catch(error){renderSkillUpdate({scope:target,phase:'Update failed',output:error.message,code:1})}
  finally{clearTimeout(timer);skillUpdateRunning=false}
};

cancelSkillUpdate=async()=>{
  const cancel=$('skillUpdateOutput')?.querySelector('[data-cancel-update]');if(cancel){cancel.disabled=true;cancel.textContent='Cancelling…'}
  try{const result=await request('skills/update-cancel',{});if(!result.cancelled)toast(result.reason);await pollSkillUpdate()}
  catch(error){toast(error.message)}
};
