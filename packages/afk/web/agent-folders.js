let agentFolderInfo,agentFolderBusy=false,showAllAgentFolders=false;

function agentFolderIcon(folder){
  const name=folder.names[0]||'?';
  if(folder.icon)return `<img class="agent-icon" src="/assets/agent-icons/${esc(folder.icon)}" alt="" width="28" height="28" loading="lazy">`;
  return `<span class="agent-icon agent-icon-letter" aria-hidden="true">${esc(name.trim().charAt(0).toUpperCase())}</span>`;
}

function agentFolderNames(folder){
  if(folder.shared)return `Read by ${folder.names.slice(0,6).map(esc).join(', ')}${folder.names.length>6?` and ${folder.names.length-6} more`:''}`;
  return '';
}

function agentFolderRow(folder){
  const title=folder.shared?`<code>${esc(folder.path)}</code>`:esc(folder.names.join(', '));
  const project=folder.project?` · projects: <code>${esc(folder.project)}</code>`:'';
  const detail=folder.shared?agentFolderNames(folder):`<code>${esc(folder.path)}</code>${project}${folder.custom?' · added by you':''}`;
  const busy=agentFolderBusy?'disabled':'';
  const control=folder.shared
    ?'<span class="meta agent-always">Always on</span>'
    :`<button type="button" role="switch" class="switch" aria-checked="${folder.enabled}" ${busy} aria-label="Link skills into ${esc(folder.names.join(', '))}" onclick="setAgentFolder(${esc(JSON.stringify(folder.path))},${!folder.enabled})" data-od-id="agent-folder-${esc(folder.path)}"><span class="track" aria-hidden="true"></span><span>${folder.enabled?'On':'Off'}</span></button>`;
  const remove=folder.custom?button('Remove',`removeAgentFolder(${esc(JSON.stringify(folder.path))})`,'text',busy):'';
  return `<li class="agent-folder"><span class="agent-folder-icon">${agentFolderIcon(folder)}</span><div class="agent-folder-main"><strong>${title}</strong><span class="meta">${detail}</span></div><div class="agent-folder-control">${control}${remove}</div></li>`;
}

function agentFolderGroup(title,folders){
  return folders.length?`<div><p class="table-label">${esc(title)}</p><ul class="agent-folder-list">${folders.map(agentFolderRow).join('')}</ul></div>`:'';
}

function renderAgentFolders(){
  const target=$('agentFoldersBody');
  if(!target)return;
  if(!agentFolderInfo){target.innerHTML='<p class="meta">Loading agent folders…</p>';return}
  if(!agentFolderInfo.library){target.innerHTML='<p class="meta">Start a library with <code>afk library init</code> to choose where skills are linked.</p>';return}
  const folders=agentFolderInfo.folders;
  const shared=folders.filter(folder=>folder.shared),custom=folders.filter(folder=>folder.custom);
  const known=folders.filter(folder=>!folder.shared&&!folder.custom);
  const detected=known.filter(folder=>folder.detected),others=known.filter(folder=>!folder.detected);
  const more=others.length?`<button type="button" class="text" aria-expanded="${showAllAgentFolders}" onclick="showAllAgentFolders=!showAllAgentFolders;renderAgentFolders()">${showAllAgentFolders?'Hide other agents':`Show ${others.length} other known folders`}</button>`:'';
  target.innerHTML=`${agentFolderGroup('Shared folder',shared)}${agentFolderGroup('Detected on this machine',detected)}${agentFolderGroup('Your folders',custom)}${showAllAgentFolders?agentFolderGroup('Other known agents',others):''}${more}<div>${button('Add a folder','showAddAgentFolder()','',agentFolderBusy?'disabled':'')}</div><p class="hint">Turning a folder off removes only AFK's links there; other files in it stay. Paths come from AFK's agent table, based on Skills CLI's. Saved in your library.</p>`;
}

async function loadAgentFolders(){
  try{agentFolderInfo=await request('agent-folders/state',{})}
  catch(error){$('agentFoldersBody')&&($('agentFoldersBody').innerHTML=`<p class="field-error">${esc(error.message)}</p>`);return}
  renderAgentFolders();
}

function renderAgentFoldersBlock(){
  const block=document.createElement('section');
  block.className='settings-block';block.dataset.odId='agent-folders';
  block.innerHTML='<div><h2>Agent folders</h2><p class="sub">Every skill that is on gets a link in each folder below. Agents read different folders, so switch on the ones you use.</p></div><div class="settings-body agent-folders" id="agentFoldersBody"></div>';
  document.querySelector('[data-od-id="projects-settings"]').before(block);
  renderAgentFolders();
  loadAgentFolders();
}

async function changeAgentFolder(operationName,data,message){
  agentFolderBusy=true;renderAgentFolders();
  try{agentFolderInfo=await request(operationName,data);toast(message)}
  catch(error){toast(error.message);return false}
  finally{agentFolderBusy=false;renderAgentFolders()}
  return true;
}

function setAgentFolder(path,on){
  const folder=agentFolderInfo.folders.find(entry=>entry.path===path);
  return changeAgentFolder(on?'agent-folders/enable':'agent-folders/disable',{path},on?`Linked skills into ${folder.names.join(', ')}.`:`Removed AFK's links from ${folder.names.join(', ')}.`);
}

function removeAgentFolder(path){
  const folder=agentFolderInfo.folders.find(entry=>entry.path===path);
  return changeAgentFolder('agent-folders/remove',{path},`Removed ${folder.names.join(', ')}.`);
}

function showAddAgentFolder(){
  modal('Add a folder',`<label>Name<input id="agentFolderName" autocomplete="off" placeholder="Team agent"></label><label>Global skills folder<input id="agentFolderGlobal" autocomplete="off" placeholder="~/.team-agent/skills"></label><label>Project skills folder (optional)<input id="agentFolderProject" autocomplete="off" placeholder=".team-agent/skills"></label><p class="hint">Use an absolute path or one starting with ~/. It cannot be inside AFK's library. AFK links every skill that is on into it.</p><p id="agentFolderError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Add folder','saveAgentFolder()','primary'),'New folder');
}

async function saveAgentFolder(){
  const data={name:$('agentFolderName').value,global:$('agentFolderGlobal').value};
  const project=$('agentFolderProject').value.trim();
  if(project)data.project=project;
  agentFolderBusy=true;
  try{agentFolderInfo=await request('agent-folders/add',data);closeModal();toast('Folder added and linked.')}
  catch(error){$('agentFolderError').textContent=error.message;return}
  finally{agentFolderBusy=false;renderAgentFolders()}
}

function invocationMechanismHint(){
  const agents=agentFolderInfo?.invocationAgents;
  if(!agents)return '';
  const parts=[];
  if(agents.claude.length)parts.push(`${agents.claude.join(', ')} follow${agents.claude.length===1?'s':''} the disable-model-invocation setting in SKILL.md.`);
  if(agents.codex.length)parts.push(`${agents.codex.join(', ')} follow${agents.codex.length===1?'s':''} agents/openai.yaml.`);
  return parts.length?`${parts.join(' ')} Other agents' behavior is unknown.`:'';
}
