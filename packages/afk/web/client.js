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
saveSource=index=>{
  const name=$('sourceName').value.trim(),source=$('sourceLink').value.trim();
  if(!name||!validSource(source)){$('sourceError').textContent='Name the source and enter a repository reference without control characters or a leading dash.';return}
  const next=currentSettings.favoriteSources.map(entry=>({...entry}));
  if(index<0)next.push({name,source});else next[index]={name,source};
  return saveForm(()=>savePatch({favoriteSources:next}),'Bookmark saved. No skills installed.','sourceError');
};
removeSource=index=>operation(async()=>{await savePatch({favoriteSources:currentSettings.favoriteSources.filter((_,position)=>position!==index)});toast('Bookmark removed. Installed skills unchanged.')});

browse=mode=>{browseMode=mode;folder=afkHome;folderModal()};
folderModal=async()=>{
  try{
    const data=await request('folders',{path:folder});folder=data.path;
    const parts=folder.split('/').filter(Boolean);
    const ancestors=[{name:'/',path:'/'}];parts.forEach((name,index)=>ancestors.push({name,path:'/'+parts.slice(0,index+1).join('/')}));
    modal('Choose '+(browseMode==='project'?'project folder':'settings location'),`<div class="folder-path">${button('Parent',`chooseFolder(${JSON.stringify(data.parent).replaceAll('"','&quot;')})`,'',data.parent===folder?'disabled':'')}<nav aria-label="Folder breadcrumbs" class="folder-crumbs">${ancestors.map((part,index)=>`<button type="button" class="text" data-ancestor="${index}" ${part.path===folder?'aria-current="location"':''}>${esc(part.name)}</button>`).join('<span aria-hidden="true">/</span>')}</nav></div><div class="list">${data.folders.map((name,index)=>`<button type="button" class="folder" data-folder-index="${index}"><span>${esc(name)}</span><span aria-hidden="true">›</span></button>`).join('')||'<p>No subfolders.</p>'}</div>`,button('Cancel','closeModal()','text')+button('Use this folder','useFolder()','primary'));
    document.querySelectorAll('[data-ancestor]').forEach(element=>element.onclick=()=>chooseFolder(ancestors[Number(element.dataset.ancestor)].path));
    document.querySelectorAll('[data-folder-index]').forEach(element=>element.onclick=()=>chooseFolder(folder+'/'+data.folders[Number(element.dataset.folderIndex)]));
  }catch(error){toast(error.message)}
};
function chooseFolder(path){folder=path;folderModal()}
const originalUseFolder=useFolder;
useFolder=()=>{
  if(browseMode==='settings'){operation(async()=>{await request('location',{path:folder+'/settings.json'});closeModal()});return}
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
showNotes=()=>modal('AFK — Fieldwork','<p>Your local workspace for skills, shared profiles, favorite sources, and global tool commands.</p><p class="sub">Settings are stored on this machine at the location you choose. Source and update controls copy commands for you to run.</p>');
refresh().catch(error=>{$('view').innerHTML=`<div class="error" role="alert">${esc(error.message)}</div>`});
discover=async(local=false)=>{
  $('discovery').textContent='Preparing a private preview through Skills CLI…';$('saveProfile').disabled=true;
  try{const result=await request('discover',{local,source:$('source').value.trim()});if(local)$('source').value='Local skill selection';renderMembers(result.names,local?'Local skills':'Source members',local)}
  catch(error){$('discovery').innerHTML=`<div class="error" role="alert">${esc(error.message)}</div>`}
};
saveProfile=()=>operation(async()=>{
  const name=$('profileName').value.trim(),skills=[...document.querySelectorAll('.member-check:checked')].map(el=>el.value),source=$('source').value.trim()||'Local skill selection';
  $('saveProfile').disabled=true;$('saveProfile').textContent='Preparing…';
  try{await request('profile/save',{id:editing?.id,name,skills,source});closeModal()}
  catch(error){$('saveProfile').disabled=false;$('saveProfile').textContent='Save & prepare';throw error}
});
removeProfile=id=>operation(async()=>{await request('profile/remove',{id});closeModal()});
retryPreparation=id=>operation(async()=>{const profile=profiles.find(p=>p.id===id);await request('profile/save',profile)});
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
  const exit=$('exitAfk');
  exit.disabled=true;exit.textContent='Exiting…';
  try{
    await request('exit',{});
    if($('sheet').open)closeModal();
    $('nav').replaceChildren();
    $('crumb').textContent='Closed';
    $('view').innerHTML='<h1 tabindex="-1" id="closedTitle">AFK is closed</h1><p>The local server has stopped accepting connections. Your configuration and enabled skills are unchanged.</p><p>You can close this tab. Start AFK from your terminal to open it again.</p>';
    exit.textContent='Closed';
    $('closedTitle').focus();
  }catch(error){
    exit.disabled=false;exit.textContent='Exit AFK';toast(error.message);
  }
};
