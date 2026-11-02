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
  return list===undefined||(Array.isArray(list)&&list.every(x=>x&&typeof x.name==='string'&&x.name.trim()&&validSource(x.source)&&(x.description===undefined||safeShellValue(x.description))&&validSkillSelection(x.skills)));
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
  const selection=skills===undefined?'':skills.map(name=>' --skill '+shellQuote(name)).join('');
  return prefix+'npx skills add '+shellQuote(source)+selection+(target==='Global'?' -g':'')+(agent==='interactive'?'':' --agent '+shellQuote(agent));
}
function updateCommand(target){return target==='Global'?'afk skills update -g':'afk skills update -p '+shellQuote(target)}
function installScript(){
  if(!favoriteSources.length)throw Error('Save a source before copying the script.');
  return '#!/bin/sh\nset -e\n# Run manually. Each source is installed sequentially; prompts remain enabled.\n'+favoriteSources.map(x=>'('+installCommand(x.source,installScope,installAgent,x.skills)+')').join('\n')+'\n';
}
async function copyText(text,label){
  try{
    if(!navigator.clipboard?.writeText)throw Error();
    await navigator.clipboard.writeText(text);
    toast(label+' copied. Nothing executed.');
  }catch{
    modal('Copy manually',`<p>Clipboard access is unavailable or was denied. Select the text below and use your device’s Copy action (Ctrl+C or ⌘C).</p><label>${esc(label)}<textarea id="manualCopy" readonly rows="8">${esc(text)}</textarea></label><p class="hint">Nothing executed. Installed skills are unchanged.</p>`,'','Clipboard recovery');
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
function sourceWebUrl(source){
  const value=source.trim();
  const shorthand=value.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if(shorthand)return 'https://github.com/'+shorthand[1]+'/'+shorthand[2];
  const ssh=value.match(/^(?:git@|ssh:\/\/git@)([a-zA-Z0-9.-]+)[:/]([^\s?#]+)$/);
  const candidate=ssh?'https://'+ssh[1]+'/'+ssh[2].replace(/\.git$/,''):value;
  try{
    const url=new URL(candidate);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
    return url.href;
  }catch{return null}
}
function sourceReference(source){
  const url=sourceWebUrl(source.source);
  const label='Open source for '+source.name+' (opens in a new tab)';
  const text=`<code class="path">${esc(source.source)}</code>`;
  return url?`<a class="source-reference" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}" title="${esc(label)}">${text}</a>`:text;
}
let sourceQuery='',expandedSources=new Set();
function sourceKey(reference){return (sourceWebUrl(reference)||reference).trim().replace(/\.git$/,'').replace(/\/+$/,'').toLowerCase()}
function sourceMatches(source,query){
  const needle=query.trim().toLowerCase();
  if(!needle)return true;
  return [source.name,source.source,source.description||'',...(source.skills||[])].some(value=>value.toLowerCase().includes(needle));
}
function sourceMenuItem(label,action,extra=''){return `<button type="button" role="menuitem" ${extra} onclick="this.closest('[popover]').hidePopover();${action}">${esc(label)}</button>`}
function sourceMenu(source,i){
  const id='source-menu-'+i;
  const items=sourceMenuItem('Copy install command',`copyInstall(${i})`)
    +sourceMenuItem('Add to Core…',`installFromSource(${i},'core')`)
    +sourceMenuItem('Add to pack…',`addSourceToPack(${i})`)
    +sourceMenuItem('Create pack',`createProfileFromSource(${i})`)
    +sourceMenuItem('Edit',`editSource(${i})`)
    +sourceMenuItem('Remove bookmark',`removeSource(${i})`,'class="danger"');
  return `<button type="button" class="source-menu-trigger" popovertarget="${id}" aria-label="More actions for ${esc(source.name)}" aria-haspopup="menu">⋯</button><div id="${id}" class="skill-invoc-popover skills-folder-popover source-menu" popover role="menu">${items}</div>`;
}
function sourceSelection(source,i){
  if(source.skills===undefined)return '<span class="meta">All skills</span>';
  const expanded=expandedSources.has(source.source);
  const label=`${source.skills.length} ${source.skills.length===1?'skill':'skills'}`;
  return `<button type="button" class="text source-skills-toggle" aria-expanded="${expanded}" aria-controls="source-skills-${i}" onclick="toggleSourceSkills(${i})">${label}</button>`;
}
function toggleSourceSkills(i){
  const source=favoriteSources[i];if(!source)return;
  if(expandedSources.has(source.source))expandedSources.delete(source.source);else expandedSources.add(source.source);
  renderSourceList();
}
function sourceRow(source,i){
  const expanded=source.skills!==undefined&&expandedSources.has(source.source);
  const description=source.description?`<span class="source-description">${esc(source.description)}</span>`:'';
  const skills=expanded?`<ul class="source-skill-tags" id="source-skills-${i}">${source.skills.map(name=>`<li class="tag">${esc(name)}</li>`).join('')}</ul>`:'';
  return `<article class="source-item" data-od-id="favorite-source-${i}"><div class="source-item-main"><h3>${esc(source.name)}</h3><div class="source-item-meta">${sourceReference(source)}${description}</div>${skills}</div><div class="source-item-selection">${sourceSelection(source,i)}</div><div class="source-item-actions">${button('Install',`installFromSource(${i})`)}${sourceMenu(source,i)}</div></article>`;
}
function renderSourceList(){
  const host=$('sourceList');if(!host)return;
  const shown=favoriteSources.map((source,i)=>[source,i]).filter(([source])=>sourceMatches(source,sourceQuery)).sort(([a],[b])=>byName(a.name,b.name));
  host.innerHTML=shown.length?shown.map(([source,i])=>sourceRow(source,i)).join(''):`<div class="empty"><h3>No matching sources</h3><p class="sub">Search covers names, links, descriptions and selected skills.</p></div>`;
}
function setSourceQuery(value){sourceQuery=value;renderSourceList()}
function sourceLinks(){
  return favoriteSources.filter(source=>sourceMatches(source,sourceQuery)).sort((a,b)=>byName(a.name,b.name)).map(source=>sourceWebUrl(source.source)||source.source);
}
function copySourceLinks(){
  const links=sourceLinks();
  if(!links.length){toast('No sources to copy.');return}
  return copyText(links.join('\n'),links.length===favoriteSources.length?'All source links':`${links.length} source ${links.length===1?'link':'links'}`);
}
function renderSourcesPanel(){
  if(!scopeNames().includes(installScope))installScope='Global';
  const search=favoriteSources.length?`<div class="source-list-tools"><label class="source-search"><span class="sr-only">Search sources</span><input type="search" id="sourceSearch" placeholder="Search sources…" value="${esc(sourceQuery)}" oninput="setSourceQuery(this.value)"></label>${button('Copy links','copySourceLinks()','','title="Copy the links of the sources shown, one per line"')}</div>`:'';
  const list=favoriteSources.length?`${search}<div class="source-list" id="sourceList"></div>`:`<div class="empty" data-od-id="sources-empty"><h2>Nothing to try yet</h2><p class="sub">Save a name and repository link to keep it close. Bookmarks do not install or enable skills.</p></div>`;
  const toolbar=`<section class="source-destination" data-od-id="installation-destination"><div class="toolbar"><label>Installation destination<select onchange="installScope=this.value;renderKit()">${scopeOptions(installScope)}</select></label><details class="source-options"><summary>Agent selection · optional</summary><label>Installation agent<select onchange="installAgent=this.value"><option value="interactive" ${installAgent==='interactive'?'selected':''}>Choose interactively in CLI</option>${['codex','claude-code','cursor','opencode'].map(a=>`<option value="${a}" ${installAgent===a?'selected':''}>${a}</option>`).join('')}</select></label></details>${button('Copy all sources script','copyInstallAll()','',favoriteSources.length?'':'disabled')}</div><p class="hint">Try a source here without adding it to your kit. Copy commands to run yourself, or use Install to run Skills CLI.</p></section>`;
  return `<div class="inline kit-panel-actions">${button('Add to try later',"showInstallSkills({to:'later'})")}</div>`+toolbar+list;
}
async function createProfileFromSource(index){
  const source=favoriteSources[index];
  if(!source)return;
  createProfile({name:source.name,source:source.source,skills:[...(source.skills||[])]},true);
  editing=null;
  if(source.skills===undefined){
    profilePicker.selectAllOnDiscovery=true;
    await discover();
  }
}
function sourceSelectionSummary(source){
  if(source.skills===undefined)return '<span class="meta source-selection-summary">All skills</span>';
  const label=`${source.skills.length} ${source.skills.length===1?'skill':'skills'} selected`;
  return `<details class="source-members"><summary>${label}</summary><ul>${source.skills.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></details>`;
}
let sourcePicker;
function sourceReferenceHint(source){
  const standard='Repository URL, SSH URL, or owner/repository. For a specific branch, use https://github.com/owner/repository#branch-name.';
  try{
    const url=new URL(source);
    const tree=url.hostname==='github.com'&&url.pathname.match(/^\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
    if(tree){
      const [,owner,repo,branch,remainder]=tree;
      return `Skills CLI reads only “${branch}” as the branch in this URL. If “${branch}/${remainder}” is the full branch name, use https://github.com/${owner}/${repo}#${branch}/${remainder}. If it includes a folder, use # followed by the exact branch name and choose the skills.`;
    }
  }catch{}
  return standard;
}
function editSource(i){
  const x=favoriteSources[i]||{name:'',source:''};
  sourcePicker={kind:'source',source:x.source,mode:x.skills===undefined?'all':'selected',names:[...(x.skills||[])],selected:new Set(x.skills||[]),query:'',selectedOnly:false,descriptions:{},version:0,loading:false,loaded:false};
  modal(i===undefined?'Add favorite source':'Edit favorite source',`<label>Name<input id="sourceName" value="${esc(x.name)}" maxlength="120"></label><label>Description · optional<input id="sourceDescription" value="${esc(x.description||'')}" maxlength="280" placeholder="What you use it for"></label><label>Source repository link<input id="sourceLink" value="${esc(x.source)}" placeholder="https://github.com/owner/repository" oninput="sourceLinkChanged()" aria-describedby="sourceHint sourceError"></label><p class="hint" id="sourceHint" aria-live="polite">${esc(sourceReferenceHint(x.source))}</p><fieldset class="profile-source"><legend>Skills to install</legend><div class="inline"><label class="check"><input type="radio" name="sourceSkills" value="all" ${sourcePicker.mode==='all'?'checked':''} onchange="setSourceMode(this.value)"><span>All skills</span></label><label class="check"><input type="radio" name="sourceSkills" value="selected" ${sourcePicker.mode==='selected'?'checked':''} onchange="setSourceMode(this.value)"><span>Choose skills</span></label></div></fieldset><div id="sourceSelection" ${sourcePicker.mode==='all'?'hidden':''}>${button('Find skills','discoverSourceSkills()','','id="discoverSourceSkills"')}<div id="sourceDiscovery"></div></div><p id="sourceError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Save bookmark',`saveSource(${i===undefined?-1:i})`,'primary','id="saveSource"'));
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
  $('sourceHint').textContent=sourceReferenceHint(source);
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
  const name=$('sourceName').value.trim(),source=$('sourceLink').value.trim(),description=$('sourceDescription').value.trim();
  if(!name||!validSource(source)){$('sourceError').textContent='Name the source and enter a repository reference without control characters or a leading dash.';return}
  if(sourcePicker.loading)return;
  const skills=sourcePicker.mode==='selected'?[...sourcePicker.selected]:undefined;
  if(!validSkillSelection(skills)){$('sourceError').textContent='Choose at least one skill or use All skills.';return}
  if(description&&!safeShellValue(description)){$('sourceError').textContent='Use a description without control characters.';return}
  const bookmark={name,source,...(description?{description}:{}),...(skills===undefined?{}:{skills})},next=currentSettings.favoriteSources.map(entry=>({...entry}));
  if(i<0)next.push(bookmark);else next[i]=bookmark;
  return saveForm(()=>savePatch({favoriteSources:next}),'Bookmark saved. No skills installed.','sourceError');
}
function removeSource(index){return operation(async()=>{await savePatch({favoriteSources:currentSettings.favoriteSources.filter((_,position)=>position!==index)});toast('Bookmark removed. Installed skills unchanged.')})}
