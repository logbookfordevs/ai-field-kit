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
let sourcesLayout='list';
function setSourcesLayout(layout){
  if(!['cards','list'].includes(layout))return;
  sourcesLayout=layout;renderSources();
}
function sourceLayoutControls(){
  return `<div class="source-view-switch" role="group" aria-label="Collection view">${['cards','list'].map(layout=>button(layout==='cards'?'Cards':'List',`setSourcesLayout('${layout}')`,'',`aria-pressed="${sourcesLayout===layout}"`)).join('')}</div>`;
}
let sourceQuery='',expandedSources=new Set();
function sourceKey(reference){return (sourceWebUrl(reference)||reference).trim().replace(/\.git$/,'').replace(/\/+$/,'').toLowerCase()}
function sourceStacks(source){
  const key=sourceKey(source.source);
  return savedStacks().filter(stack=>stack.manifest.sources.some(group=>sourceKey(group.source)===key)).map(stack=>stack.manifest.name);
}
function sourceMatches(source,query){
  const needle=query.trim().toLowerCase();
  if(!needle)return true;
  return [source.name,source.source,source.description||'',...(source.skills||[]),...sourceStacks(source)].some(value=>value.toLowerCase().includes(needle));
}
function sourceMenuItem(label,action,extra=''){return `<button type="button" role="menuitem" ${extra} onclick="this.closest('[popover]').hidePopover();${action}">${esc(label)}</button>`}
function sourceMenu(source,i){
  const id='source-menu-'+i;
  const items=(source.skills===undefined?sourceMenuItem('Install all skills…',`showInstallation('source',${i},true)`):'')
    +sourceMenuItem('Copy install command',`copyInstall(${i})`)
    +sourceMenuItem('Add to stack…',`addSourceToStack(${i})`)
    +sourceMenuItem('Create profile',`createProfileFromSource(${i})`)
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
  const stacks=sourceStacks(source);
  const stackTags=stacks.length?`<ul class="source-stack-tags" aria-label="In stacks">${stacks.map(name=>`<li><button type="button" class="source-stack-tag" onclick="setSourcesTab('stacks')" title="In stack ${esc(name)} · open Stacks">${esc(name)}</button></li>`).join('')}</ul>`:'';
  return `<article class="source-item" data-od-id="favorite-source-${i}"><div class="source-item-main"><h3>${esc(source.name)}</h3><div class="source-item-meta">${sourceReference(source)}${description}</div>${stackTags}${skills}</div><div class="source-item-selection">${sourceSelection(source,i)}</div><div class="source-item-actions">${button('Install',`showInstallation('source',${i})`)}${sourceMenu(source,i)}</div></article>`;
}
function renderSourceList(){
  const host=$('sourceList');if(!host)return;
  const shown=favoriteSources.map((source,i)=>[source,i]).filter(([source])=>sourceMatches(source,sourceQuery));
  host.innerHTML=shown.length?shown.map(([source,i])=>sourceRow(source,i)).join(''):`<div class="empty"><h3>No matching sources</h3><p class="sub">Search covers names, links, descriptions, selected skills and stack names.</p></div>`;
}
function setSourceQuery(value){sourceQuery=value;renderSourceList()}
function sourceLinks(){
  return favoriteSources.filter(source=>sourceMatches(source,sourceQuery)).map(source=>sourceWebUrl(source.source)||source.source);
}
function copySourceLinks(){
  const links=sourceLinks();
  if(!links.length){toast('No sources to copy.');return}
  return copyText(links.join('\n'),links.length===favoriteSources.length?'All source links':`${links.length} source ${links.length===1?'link':'links'}`);
}
let sourcesTab='sources';
function setSourcesTab(tab){
  if(!['sources','stacks'].includes(tab))return;
  sourcesTab=tab;renderSources();$('sourcesTab-'+tab)?.focus();
}
function sourcesTabKey(event){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  setSourcesTab(event.key==='Home'?'sources':event.key==='End'?'stacks':sourcesTab==='sources'?'stacks':'sources');
}
function sourcesTabs(){
  const tabs=[['sources','Sources',favoriteSources.length],['stacks','Stacks',savedStacks().length]];
  return `<div class="page-tabs" role="tablist" aria-label="Sources and stacks">${tabs.map(([id,label,count])=>`<button type="button" role="tab" id="sourcesTab-${id}" aria-selected="${sourcesTab===id}" aria-controls="sourcesPanel" tabindex="${sourcesTab===id?0:-1}" onclick="setSourcesTab('${id}')" onkeydown="sourcesTabKey(event)">${label} <span class="meta">${count}</span></button>`).join('')}</div>`;
}
function renderSources(){
  if(!scopeNames().includes(installScope))installScope='Global';
  const search=favoriteSources.length?`<div class="source-list-tools"><label class="source-search"><span class="sr-only">Search sources</span><input type="search" id="sourceSearch" placeholder="Search sources…" value="${esc(sourceQuery)}" oninput="setSourceQuery(this.value)"></label>${button('Copy links','copySourceLinks()','','title="Copy the links of the sources shown, one per line"')}</div>`:'';
  const list=favoriteSources.length?`${search}<div class="source-list" id="sourceList"></div>`:`<div class="empty" data-od-id="sources-empty"><h2>No favorite sources yet</h2><p class="sub">Save a name and repository link to keep it close. Bookmarks do not install or enable skills.</p></div>`;
  const toolbar=`<section class="source-destination" data-od-id="installation-destination"><div class="toolbar"><label>Installation destination<select onchange="installScope=this.value;renderSources()">${scopeOptions(installScope)}</select></label><details class="source-options"><summary>Agent selection · optional</summary><label>Installation agent<select onchange="installAgent=this.value"><option value="interactive" ${installAgent==='interactive'?'selected':''}>Choose interactively in CLI</option>${['codex','claude-code','cursor','opencode'].map(a=>`<option value="${a}" ${installAgent===a?'selected':''}>${a}</option>`).join('')}</select></label></details>${sourcesTab==='sources'?button('Copy all sources script','copyInstallAll()','',favoriteSources.length?'':'disabled'):''}</div><p class="hint">Copy commands to run yourself, or use Install on a source or stack to run Skills CLI here.</p></section>`;
  const panel=sourcesTab==='sources'?list:renderStacks(sourcesLayout,sourceLayoutControls());
  $('view').innerHTML=head('Sources & Stacks','Keep repository bookmarks and reusable selections from multiple sources.','<div class="inline source-actions">'+button('Add source','editSource()')+button('Create stack','createStack()')+button('Import stack','importStack()','primary')+'</div>')+toolbar+sourcesTabs()+`<div id="sourcesPanel" role="tabpanel" aria-labelledby="sourcesTab-${sourcesTab}">${panel}</div>`+`<aside class="note"><span class="table-label">Bookmarks, not inventory</span><p>Sources and stacks travel with your configuration. Removing one leaves installed skills unchanged. Refreshing a stack changes its saved selection; update installed packages from Installed Skills.</p></aside>`;
  if(sourcesTab==='sources')renderSourceList();
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

let installationTarget,installationRunning=false,installationPicker;
function showInstallation(kind,index,all=false){
  const item=kind==='stack'?savedStacks()[index]:favoriteSources[index];
  const label=kind==='stack'?item.manifest.name:item.name;
  const allowsAll=kind==='source'&&item.skills===undefined;
  const installsAll=allowsAll&&all;
  installationTarget={kind,label,scope:installScope,allowsAll,...(kind==='stack'?{id:item.manifest.id}:{source:item.source})};
  installationPicker=allowsAll&&!installsAll?{kind:'installation',selected:new Set(),loading:false,loaded:false}:undefined;
  const chosen=installAgent==='interactive'?'universal':installAgent;
  modal('Install '+esc(label),`<p>Install through Skills CLI. Installation can replace existing skills and make them available. Use Update in Installed Skills to preserve an existing skill’s disabled state.</p><label>Installation folder<select id="installationScope" onchange="setInstallationScope(this.value)">${scopeOptions(installScope)}</select></label><p id="installationFolder" class="hint">${esc(installationFolderHint(installScope))}</p><label>Installation agent<select id="installationAgent">${['universal','codex','claude-code','cursor','opencode'].map(agent=>`<option value="${agent}" ${chosen===agent?'selected':''}>${agent==='universal'?'Universal · .agents/skills':agent}</option>`).join('')}</select></label>${kind==='stack'?`<fieldset id="installationMode" class="profile-source"><legend>What to install</legend><label class="check"><input type="radio" name="installationMode" id="installationOnlyMissing" value="missing" onchange="setInstallationMode(true)"><span><strong>Only what’s missing</strong><br><span id="installationMissingHint" class="hint"></span></span></label><label class="check"><input type="radio" name="installationMode" id="installationAll" value="all" onchange="setInstallationMode(false)"><span><strong>Everything in the stack</strong><br><span class="hint">Replaces skills already installed here and turns disabled ones back on.</span></span></label></fieldset><div id="installationPlan"></div>`:''}${installationPicker?`<section id="installationSelection"><div class="installation-discovery-actions">${button('Find skills','discoverInstallationSkills()','','id="findInstallationSkills"')}${button('Install all instead…','chooseInstallationAll()','text')}<span id="installationDiscoveryStatus" class="hint" role="status" aria-live="polite"></span></div><div id="installationDiscovery"></div></section>`:installsAll?'<section id="installationSelection"><p>Install all skills currently available in this repository.</p></section>':''}<p class="hint">The copied script keeps its current behavior. This action runs without terminal prompts. Closing this dialog does not stop installation.</p><div id="installationOutput" role="status" aria-live="polite"></div><p id="installationError" class="field-error" role="alert"></p>`,button('Cancel installation','cancelInstallation()','text danger','id="cancelInstallation" hidden')+button('Close','closeModal()','text')+button(installsAll?'Install all skills':'Install','executeInstallation()','primary','id="startInstallation"'));
  if($('cancelInstallation')){$('cancelInstallation').disabled=false;$('cancelInstallation').textContent='Cancel installation';}
  if(kind==='stack')renderStackInstallPlan(true);
  if(installationPicker)discoverInstallationSkills();
  pollInstallation();
}
function chooseInstallationAll(){
  if(installationRunning||!installationTarget?.allowsAll)return;
  installationPicker=undefined;
  $('installationSelection').innerHTML='<p>Install all skills currently available in this repository.</p>';
  $('installationError').textContent='';
  $('startInstallation').textContent='Install all skills';
  updateInstallationSelection();
  $('startInstallation').focus();
}
function installationFolderHint(scope){return scope==='Global'?'Your home folder, available to every project.':projects.find(project=>project.name===scope)?.path||''}
function setInstallationScope(value){
  if(!installationTarget||installationRunning)return;
  installationTarget.scope=value;
  $('installationFolder').textContent=installationFolderHint(value);
  if(installationTarget.kind==='stack')renderStackInstallPlan(true);
}
function updateInstallationSelection(){
  const control=$('startInstallation');
  if(control)control.disabled=installationRunning||!!installationPicker&&(installationPicker.loading||!installationPicker.loaded||!installationPicker.selected.size);
}
async function discoverInstallationSkills(){
  const picker=installationPicker,target=installationTarget,body=$('sheetContent').firstElementChild;
  if(!picker||picker.loading)return;
  const current=()=>installationPicker===picker&&installationTarget===target&&$('sheet').open&&body.isConnected;
  picker.loading=true;$('findInstallationSkills').disabled=true;$('installationError').textContent='';
  $('installationDiscoveryStatus').textContent='Finding skills…';updateInstallationSelection();
  try{
    const result=await request('discover',{source:target.source});if(!current())return;
    if(!Array.isArray(result.names)||result.names.some(name=>!validSkillSelection([name])))throw Error('The source returned an invalid skill list.');
    picker.loaded=true;
    renderMembers(result.names,'Skills to install',false,[...picker.selected],result.descriptions||{},picker,result.paths||{});
  }catch(error){if(current()){$('installationDiscovery').textContent='';$('installationError').textContent=error.message}}
  finally{if(current()){picker.loading=false;$('installationDiscoveryStatus').textContent='';$('findInstallationSkills').disabled=false;updateInstallationSelection()}}
}
function renderInstallation(result){
  const output=$('installationOutput');if(!output||!result)return;
  if(result.label!==installationTarget.label||result.scope!==installationTarget.scope){if(!result.pending)return;}
  if(!output.querySelector('[data-install-summary]'))output.innerHTML='<div data-install-summary><p class="meta install-context"></p><div class="install-progress"><div class="install-progress-row"><strong class="install-phase"></strong><span class="meta install-count"></span></div><div class="install-bar" role="progressbar" aria-label="Sources installed" aria-valuemin="0"><span></span></div></div><p class="install-note" hidden>Completed installations and any partial files are kept. Review the output before retrying.</p></div><details><summary>Skills CLI output</summary><pre></pre></details>';
  const summary=output.querySelector('[data-install-summary]');
  const failed=!result.pending&&!!result.code,done=!result.pending&&!result.code;
  const percent=result.total?Math.min(100,Math.round(result.completed/result.total*100)):0;
  const bar=summary.querySelector('.install-bar');
  summary.querySelector('.install-context').textContent=`${result.label} · ${result.scope} · ${result.agent}`;
  summary.querySelector('.install-progress').dataset.state=result.pending?'pending':failed?'failed':'done';
  summary.querySelector('.install-phase').textContent=(done?'✓ ':'')+result.phase;
  summary.querySelector('.install-count').textContent=`${result.completed} of ${result.total} installed`;
  bar.setAttribute('aria-valuemax',result.total);bar.setAttribute('aria-valuenow',result.completed);
  bar.firstElementChild.style.width=percent+'%';
  summary.querySelector('.install-note').hidden=!failed;
  output.querySelector('pre').textContent=result.output||'Preparing…';
  const cancel=$('cancelInstallation');cancel.hidden=!result.pending;
  if($('startInstallation'))$('startInstallation').disabled=result.pending||installationTarget.kind==='stack'&&stackInstallBlocked();
  document.querySelectorAll('#installationMode input').forEach(control=>control.disabled=result.pending||control.dataset.locked==='true');
  if(installationPicker)updateInstallationSelection();
  if($('installationSelection'))$('installationSelection').querySelectorAll('input,button').forEach(control=>control.disabled=result.pending);
  if($('installationAgent'))$('installationAgent').disabled=result.pending;
  if($('installationScope'))$('installationScope').disabled=result.pending;
}
async function pollInstallation(){
  try{const result=await request('skills/install-state',{});installationRunning=!!result?.pending;renderInstallation(result);if(result?.pending&&$('installationOutput'))setTimeout(pollInstallation,1000)}catch{}
}
async function executeInstallation(){
  if(installationRunning){await pollInstallation();return}
  const target={...installationTarget},agent=$('installationAgent').value;
  if(installationPicker&&(installationPicker.loading||!installationPicker.loaded||!installationPicker.selected.size)){$('installationError').textContent='Choose at least one skill to install.';return}
  if(!agent){$('installationError').textContent='Choose an installation agent first.';return}
  $('installationError').textContent='';installationRunning=true;$('cancelInstallation').disabled=false;$('cancelInstallation').textContent='Cancel installation';
  renderInstallation({label:target.label,scope:target.scope,agent,pending:true,phase:'Preparing installation…',output:'',completed:0,total:target.kind==='stack'?stackInstallSourceCount(target):1});
  const timer=setTimeout(pollInstallation,1000);
  try{
    const data={scope:target.scope,agent,...(target.kind==='stack'?{id:target.id,...(target.onlyMissing?{onlyMissing:true}:{})}:{source:target.source,...(installationPicker?{skills:[...installationPicker.selected]}:{})})};
    const result=await request(target.kind+'/install',data);renderInstallation(result);await refresh();if(target.kind==='stack'&&installationTarget?.id===target.id)renderStackInstallPlan(false);toast(result.code===0?'Installation complete.':result.cancelled?'Installation cancelled. Completed changes are kept.':'Installation stopped. Review the output.');
  }catch(error){$('installationError')&&($('installationError').textContent=error.message);if($('startInstallation'))$('startInstallation').disabled=false;if($('installationAgent'))$('installationAgent').disabled=false;if($('installationScope'))$('installationScope').disabled=false;}
  finally{clearTimeout(timer);installationRunning=false;updateInstallationSelection()}
}
async function cancelInstallation(){
  const control=$('cancelInstallation');if(control){control.disabled=true;control.textContent='Cancelling…'}
  try{const result=await request('skills/install-cancel',{});if(!result.cancelled)toast(result.reason);await pollInstallation()}catch(error){toast(error.message)}
}
