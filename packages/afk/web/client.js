let currentSettings, inventories={}, afkHome='',toolRuns={};
async function request(path,data){
  const response=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:{'X-AFK-Token':window.afkToken,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Operation failed.');
  return result;
}
async function refresh(){
  const state=await request('state');
  currentSettings=state.settings;inventories=state.inventories;settingsPath=state.settingsPath;afkHome=state.home;
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
  await request('activation',{id,scope:target,enabled:!profile.enabled.includes(target)});
});
toggleSkill=name=>operation(()=>request('skill/toggle',{name,scope}));
inspectSkill=async(name,fromProfile,file='SKILL.md')=>{
  try{
    const selectedScope=fromProfile?'Global':scope;
    const data=await request('skill/read',{name,scope:selectedScope,file});
    modal(esc(name),`<p class="path">${esc(data.path)}</p><label>Skill file<select id="previewFile">${data.files.map(path=>`<option ${path===file?'selected':''}>${esc(path)}</option>`).join('')}</select></label><pre>${esc(data.content)}</pre>`,'','Skill instructions');
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
showNotes=()=>modal('AFK — Fieldwork','<p>Your local workspace for skills, shared profiles, favorite sources, global tool commands, and shared agent rules.</p><p class="sub">Settings and rule files live together in the AFK folder you choose. Source and update controls copy commands for you to run.</p>',button('Show Welcome','showWelcome()'));
refresh().then(maybeWelcome).catch(error=>{$('view').innerHTML=`<div class="error" role="alert">${esc(error.message)}</div>`});
discover=async()=>{
  const picker=profilePicker,source=$('source').value.trim(),version=++picker.version;
  const isCurrent=()=>profilePicker===picker&&version===picker.version&&$('sheet').open&&Boolean($('discoverMembers'));
  if(!source){$('profileError').textContent='Enter a repository to find its skills.';$('source').focus();return}
  $('profileError').textContent='';$('discovery').innerHTML='<p role="status">Finding skills in this repository…</p>';$('saveProfile').disabled=true;$('discoverMembers').disabled=true;
  try{const result=await request('discover',{source});if(!isCurrent())return;renderMembers(result.names,'Repository skills',false,[],result.descriptions||{},picker,result.paths||{})}
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
