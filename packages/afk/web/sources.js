function safeShellValue(value){
  return typeof value==='string'&&value.trim().length>0&&!/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value);
}
function shellQuote(value){
  if(!safeShellValue(value))throw Error('Use a nonempty value without control characters or invalid Unicode.');
  return "'"+value.replaceAll("'", "'\"'\"'")+"'";
}
function validSource(value){return safeShellValue(value)&&!value.startsWith('-')}
function validSkillSelection(skills){return skills===undefined||(Array.isArray(skills)&&skills.length>0&&new Set(skills).size===skills.length&&skills.every(name=>typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)&&name!=='.'&&name!=='..'))}
function validSources(list){
  return list===undefined||(Array.isArray(list)&&list.every(x=>x&&typeof x.name==='string'&&x.name.trim()&&validSource(x.source)&&validSkillSelection(x.skills)));
}
function projectPrefix(target){
  const path=projects.find(p=>p.name===target)?.path;
  if(!safeShellValue(path))throw Error('Remap the local project directory before copying.');
  const directory=path==='~'?'"$HOME"':path.startsWith('~/')?'"$HOME"/'+shellQuote(path.slice(2)):shellQuote(path);
  return 'cd -- '+directory+' && ';
}
function installCommand(source,target=installScope,agent=installAgent,skills){
  if(!validSource(source))throw Error('Use a source without control characters or a leading dash.');
  if(!['interactive','codex','claude-code','cursor','opencode'].includes(agent))throw Error('Choose a supported agent.');
  if(!validSkillSelection(skills))throw Error('Choose at least one valid, unique skill or use All skills.');
  const prefix=target==='Global'?'':projectPrefix(target);
  const selection=skills===undefined?" --skill '*'":skills.map(name=>' --skill '+shellQuote(name)).join('');
  return prefix+'npx skills add '+shellQuote(source)+selection+(target==='Global'?' -g':'')+(agent==='interactive'?'':' --agent '+shellQuote(agent));
}
function updateCommand(target){return target==='Global'?'npx skills update -g':projectPrefix(target)+'npx skills update -p'}
function installScript(){
  if(!favoriteSources.length)throw Error('Save a source before copying the script.');
  return '#!/bin/sh\nset -e\n# Run manually. Each source is installed sequentially; prompts remain enabled.\n'+favoriteSources.map(x=>'('+installCommand(x.source,installScope,installAgent,x.skills)+')').join('\n')+'\n';
}
async function copyText(text,label){
  try{
    if(!navigator.clipboard?.writeText)throw Error();
    await navigator.clipboard.writeText(text);
    toast(label+' copied. Nothing executed; activation unchanged.');
  }catch{
    modal('Copy manually',`<p>Clipboard access is unavailable or was denied. Select the text below and use your device’s Copy action (Ctrl+C or ⌘C).</p><label>${esc(label)}<textarea id="manualCopy" readonly rows="8">${esc(text)}</textarea></label><p class="hint">Nothing executed. Profile activation and installed inventory are unchanged.</p>`,'','Clipboard recovery');
    $('manualCopy').focus();$('manualCopy').select();
  }
}
function copyGenerated(make,label,target){
  try{return copyText(make(),label)}catch(error){
    if(target&&target!=='Global'&&!safeShellValue(projects.find(p=>p.name===target)?.path)){remapProject(target);return}
    toast(error.message);
  }
}
function copyUpdateAll(){return copyGenerated(()=>updateCommand(scope),'Update-all command',scope)}
function copyInstall(i){return copyGenerated(()=>installCommand(favoriteSources[i].source,installScope,installAgent,favoriteSources[i].skills),'Install command',installScope)}
function copyInstallAll(){return copyGenerated(installScript,'Install-all script',installScope)}
function remapProject(target){
  const i=projects.findIndex(p=>p.name===target);
  if(i<0){toast('Choose a defined project in Settings.');return}
  modal('Remap project directory',`<p>${esc(target)} needs a local directory. No command has been copied.</p><label>Local project directory<input id="remapDirectory" value="${esc(projects[i].path||'')}" placeholder="~/Projects/my-project"></label><p class="hint">This changes the project definition only; activation is unchanged.</p>`,button('Cancel','closeModal()','text')+button('Save directory',`saveRemap(${i})`,'primary'),'Settings · project definition');
}
function saveRemap(i){
  const path=$('remapDirectory').value.trim();
  if(!safeShellValue(path)){toast('Enter a directory without control characters.');return}
  projects[i].path=path;closeModal();render();toast('Directory remapped. Copy the command when ready.');
}
function renderSources(){
  if(!scopeNames().includes(installScope))installScope='Global';
  const list=favoriteSources.length?`<div class="ledger">${favoriteSources.map((x,i)=>`<article class="row source-row" data-od-id="favorite-source-${i}"><div class="source-info"><h2>${esc(x.name)}</h2><code class="path">${esc(x.source)}</code>${sourceSelectionSummary(x)}</div><div class="inline">${button('Copy install command',`copyInstall(${i})`)}${button('Edit',`editSource(${i})`,'text')}${button('Remove bookmark',`removeSource(${i})`,'text')}</div></article>`).join('')}</div>`:`<div class="empty" data-od-id="sources-empty"><h2>No favorite sources yet</h2><p class="sub">Save a name and repository link to keep it close. Bookmarks do not install or enable skills.</p></div>`;
  $('view').innerHTML=head('Favorite skill sources','Repository bookmarks with all skills or your selection, shared across your configuration.',button('Add source','editSource()','primary'))+`<section class="source-destination" data-od-id="installation-destination"><div class="toolbar"><label>Installation destination<select onchange="installScope=this.value;renderSources()">${scopeOptions(installScope)}</select></label><details class="source-options"><summary>Agent selection · optional</summary><label>Installation agent<select onchange="installAgent=this.value"><option value="interactive" ${installAgent==='interactive'?'selected':''}>Choose interactively in CLI</option>${['codex','claude-code','cursor','opencode'].map(a=>`<option value="${a}" ${installAgent===a?'selected':''}>${a}</option>`).join('')}</select></label></details>${button('Copy install-all script','copyInstallAll()','',favoriteSources.length?'':'disabled')}</div><p class="hint">Copies commands for each bookmark’s skill selection. Nothing runs here.</p></section>`+list+`<aside class="note"><span class="table-label">Bookmarks, not inventory</span><p>Bookmarks travel with your configuration. Removing one leaves installed skills unchanged.</p></aside>`;
}
function sourceSelectionSummary(source){
  if(source.skills===undefined)return '<span class="meta source-selection-summary">All skills</span>';
  const label=`${source.skills.length} ${source.skills.length===1?'skill':'skills'} selected`;
  return `<details class="source-members"><summary>${label}</summary><ul>${source.skills.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></details>`;
}
let sourcePicker;
function editSource(i){
  const x=favoriteSources[i]||{name:'',source:''};
  sourcePicker={kind:'source',source:x.source,mode:x.skills===undefined?'all':'selected',names:[...(x.skills||[])],selected:new Set(x.skills||[]),query:'',selectedOnly:false,descriptions:{},version:0,loading:false,loaded:false};
  modal(i===undefined?'Add favorite source':'Edit favorite source',`<label>Name<input id="sourceName" value="${esc(x.name)}" maxlength="120"></label><label>Source repository link<input id="sourceLink" value="${esc(x.source)}" placeholder="https://github.com/owner/repository" oninput="sourceLinkChanged()" aria-describedby="sourceHint sourceError"></label><p class="hint" id="sourceHint">Repository URL, SSH URL, or owner/repository.</p><fieldset class="profile-source"><legend>Skills to install</legend><div class="inline"><label class="check"><input type="radio" name="sourceSkills" value="all" ${sourcePicker.mode==='all'?'checked':''} onchange="setSourceMode(this.value)"><span>All skills</span></label><label class="check"><input type="radio" name="sourceSkills" value="selected" ${sourcePicker.mode==='selected'?'checked':''} onchange="setSourceMode(this.value)"><span>Choose skills</span></label></div></fieldset><div id="sourceSelection" ${sourcePicker.mode==='all'?'hidden':''}>${button('Find skills','discoverSourceSkills()','','id="discoverSourceSkills"')}<div id="sourceDiscovery"></div></div><p id="sourceError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Save bookmark',`saveSource(${i===undefined?-1:i})`,'primary','id="saveSource"'));
  showSourceSelection();
}
function showSourceSelection(){
  const picker=sourcePicker;
  $('sourceSelection').hidden=picker.mode==='all';
  if(picker.mode==='selected'){
    if(picker.names.length)renderMembers(picker.availableNames||picker.names,picker.loaded?'Repository skills':'Saved selection',false,[...picker.selected],picker.descriptions,picker);
    else $('sourceDiscovery').innerHTML='<p class="hint">Find this source’s skills, then choose the ones to keep in this bookmark.</p>';
  }
  updateSourceSave();
}
function updateSourceSave(){const picker=sourcePicker;$('saveSource').disabled=picker.loading||(picker.mode==='selected'&&!picker.selected.size)}
function setSourceMode(mode){
  sourcePicker.mode=mode;sourcePicker.version++;sourcePicker.loading=false;
  $('discoverSourceSkills').disabled=false;$('discoverSourceSkills').textContent='Find skills';$('sourceError').textContent='';
  showSourceSelection();
}
function sourceLinkChanged(){
  const source=$('sourceLink').value.trim(),picker=sourcePicker;
  if(source===picker.source)return;
  const hadSelection=picker.selected.size>0;
  Object.assign(picker,{source,names:[],availableNames:undefined,selected:new Set(),descriptions:{},paths:{},version:picker.version+1,loading:false,loaded:false});
  $('discoverSourceSkills').disabled=false;$('discoverSourceSkills').textContent='Find skills';
  $('sourceError').textContent=hadSelection?'The source changed. Choose its skills again.':'';
  showSourceSelection();
}
async function discoverSourceSkills(){
  const picker=sourcePicker,source=$('sourceLink').value.trim(),version=++picker.version;
  const isCurrent=()=>sourcePicker===picker&&version===picker.version&&$('sheet').open&&Boolean($('sourceSelection'))&&picker.mode==='selected';
  if(!validSource(source)){$('sourceError').textContent='Enter a source before finding its skills.';$('sourceLink').focus();return}
  const control=$('discoverSourceSkills');
  picker.loading=true;control.disabled=true;control.textContent='Finding skills…';$('sourceError').textContent='';updateSourceSave();
  try{
    const result=await request('discover',{source});if(!isCurrent())return;
    if(!Array.isArray(result.names)||result.names.some(name=>!validSkillSelection([name])))throw Error('The source returned an invalid skill list. Try another repository.');
    picker.loaded=true;picker.availableNames=result.names;
    renderMembers(result.names,'Repository skills',false,[...picker.selected],result.descriptions||{},picker,result.paths||{});
  }catch(error){if(isCurrent())$('sourceError').textContent=error.message}
  finally{if(isCurrent()){picker.loading=false;control.disabled=false;control.textContent='Find skills';updateSourceSave()}}
}
function saveSource(i){
  const name=$('sourceName').value.trim(),source=$('sourceLink').value.trim();
  if(!name||!validSource(source)){$('sourceError').textContent='Name the source and enter a repository reference without control characters or a leading dash.';return}
  if(sourcePicker.loading)return;
  const skills=sourcePicker.mode==='selected'?[...sourcePicker.selected]:undefined;
  if(!validSkillSelection(skills)){$('sourceError').textContent='Choose at least one skill or use All skills.';return}
  const bookmark={name,source,...(skills===undefined?{}:{skills})},next=currentSettings.favoriteSources.map(entry=>({...entry}));
  if(i<0)next.push(bookmark);else next[i]=bookmark;
  return saveForm(()=>savePatch({favoriteSources:next}),'Bookmark saved. No skills installed.','sourceError');
}
function removeSource(index){return operation(async()=>{await savePatch({favoriteSources:currentSettings.favoriteSources.filter((_,position)=>position!==index)});toast('Bookmark removed. Installed skills unchanged.')})}
