const installDestinations=[['core','Core','Install now, on every machine'],['pack','A pack','Ready, on when you need it'],['machine','This machine','Install, never travels'],['later','Try later','Bookmark, no install']];
let installDialog,installationPicker;
function installPrefs(){try{return JSON.parse(localStorage.getItem('afk.install'))||{}}catch{return {}}}
function saveInstallPrefs(patch){try{localStorage.setItem('afk.install',JSON.stringify({...installPrefs(),...patch}))}catch{/* Preferences are a convenience; private modes can refuse them. */}}
function installAgentChoice(){return installPrefs().agent||'universal'}
const uploadLimit=25*1024*1024;
function showInstallSkills({source='',to,selected=[],scope:installScope='Global',askDestination=false}={}){
  const prefs=installPrefs();
  installDialog={kind:'repo',upload:null,source,selected,to:to||(askDestination?'':prefs.to)||'',packTarget:profiles.length?'':'new-pack',scope:installScope,candidates:[],version:0,finding:false,found:false,running:false,finished:false};
  installationPicker={kind:'installation',selected:new Set(),names:[]};
  const destinations=installDestinations.map(([value,label,hint])=>`<label class="install-destination" id="installDestination-${value}"><input type="radio" id="installTo-${value}" name="installTo" value="${value}" ${installDialog.to===value?'checked':''} onchange="setInstallDestination('${value}')"><span><strong>${label}</strong><small>${hint}</small></span></label>`).join('');
  const agents=['universal','codex','claude-code','cursor','opencode'].map(value=>`<option value="${value}" ${installAgentChoice()===value?'selected':''}>${value==='universal'?'Universal · .agents/skills':value}</option>`).join('');
  const kinds=[['repo','Repository'],['file','Zip or folder']].map(([value,label])=>`<button type="button" role="tab" id="installKind-${value}" aria-selected="${value==='repo'}" onclick="setInstallKind('${value}')">${label}</button>`).join('');
  const picker=`<div class="upload-drop" id="uploadDrop" ondragover="event.preventDefault();this.classList.add('dragging')" ondragleave="this.classList.remove('dragging')" ondrop="dropUpload(event)"><strong>Drop a .zip, a .skill file or a folder</strong><div class="row-actions">${button('Choose file…',"$('uploadFile').click()",'','id="chooseUploadFile"')}${button('Choose folder…',"$('uploadFolder').click()",'','id="chooseUploadFolder"')}</div><input id="uploadFile" type="file" accept=".zip,.skill" hidden aria-label="Zip or .skill file" onchange="chooseUploadFiles(this.files);this.value=''"><input id="uploadFolder" type="file" webkitdirectory hidden aria-label="Skill folder" onchange="chooseUploadFiles(this.files);this.value=''"></div>`;
  modal('Install skills',`<div class="page-tabs install-kinds" role="tablist" aria-label="Install from">${kinds}</div><div id="installRepoPane"><div class="install-source"><label>Repository<input id="installSource" value="${esc(source)}" placeholder="owner/repository or URL" oninput="installSourceChanged()" onkeydown="if(event.key==='Enter'){event.preventDefault();findInstallSkills()}"></label>${button('Find skills','findInstallSkills()','','id="findInstallSkills"')}</div></div><div id="installFilePane" hidden>${picker}<p id="uploadNote" class="hint" hidden>Uploaded skills have no source repository, so they can’t auto-update. In Core or a pack their files are saved in your library and backup; turning a pack on just links them. A pack with one can’t be exported as a manifest.</p></div><p id="installSkipped" class="hint" hidden></p><div id="installationDiscovery"></div><fieldset class="profile-source"><legend>Where should they go?</legend><div class="install-destinations">${destinations}</div></fieldset><div id="installTarget"></div><details class="source-options" id="installAgentOptions"><summary>Installation agent</summary><label>Agent<select id="installAgent" onchange="saveInstallPrefs({agent:this.value})">${agents}</select></label></details><div id="installOutput" role="status" aria-live="polite"></div><p id="installError" class="field-error" role="alert"></p>`,button('Cancel installation','cancelInstallSkills()','text danger','id="cancelInstall" hidden')+button('Close','closeModal()','text')+button('Install','applyInstallSkills()','primary','id="startInstall" disabled'));
  renderInstallTarget();
  updateInstallationSelection();
  request('skills/install-state',{}).then(progress=>{if(progress?.pending)renderInstallProgress(progress)}).catch(()=>{});
  if(source)findInstallSkills();
}
function installFromSource(index,to){
  const source=favoriteSources[index];
  if(source)showInstallSkills({source:source.source,to,selected:source.skills||[],askDestination:true});
}
function setInstallKind(kind){
  const dialog=installDialog;
  if(!dialog||dialog.kind===kind||dialog.running)return;
  dialog.kind=kind;dialog.version++;dialog.found=false;dialog.finding=false;dialog.candidates=[];dialog.selected=[];dialog.upload=null;
  installationPicker={kind:'installation',selected:new Set(),names:[]};
  const file=kind==='file';
  for(const [value] of [['repo'],['file']])$('installKind-'+value).setAttribute('aria-selected',String(value===kind));
  $('installRepoPane').hidden=file;$('installFilePane').hidden=!file;$('installAgentOptions').hidden=file;
  $('installDestination-later').hidden=file;
  if(file&&dialog.to==='later')dialog.to='';
  for(const [value] of installDestinations)$('installTo-'+value).checked=dialog.to===value;
  $('installationDiscovery').innerHTML='';$('installSkipped').hidden=true;$('uploadNote').hidden=true;$('installError').textContent='';
  renderInstallTarget();updateInstallationSelection();
}
function fileBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function uploadSize(bytes){return bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`}
function chooseUploadFiles(list){
  return uploadFiles([...list].map(file=>({file,name:file.name,size:file.size,path:file.webkitRelativePath||''})));
}
async function uploadFiles(items){
  const dialog=installDialog,error=$('installError');
  if(!items.length)return;
  error.textContent='';
  if(items.reduce((sum,item)=>sum+item.size,0)>uploadLimit){error.textContent=`That is too large. Skills can total at most ${uploadLimit/1024/1024} MB.`;return}
  const folder=items.every(item=>item.path),single=items.length===1&&!items[0].path;
  if(!folder&&!single){error.textContent='Choose one zip, one .skill file or one folder.';return}
  try{
    const payload=single?{archive:await fileBase64(items[0].file),name:items[0].name}:{files:await Promise.all(items.map(async item=>({path:item.path,base64:await fileBase64(item.file)})))};
    if(installDialog===dialog)await previewUpload(payload);
  }catch(failure){if(installDialog===dialog)error.textContent=failure.message||'Could not read that file.'}
}
function droppedEntries(entry,prefix=''){
  if(entry.isFile)return new Promise(resolve=>entry.file(file=>resolve([{file,name:file.name,size:file.size,path:prefix?prefix+file.name:''}]),()=>resolve([])));
  return new Promise(resolve=>{
    const reader=entry.createReader(),found=[];
    const next=()=>reader.readEntries(async entries=>{
      if(!entries.length){resolve(found);return}
      for(const child of entries)found.push(...await droppedEntries(child,prefix+entry.name+'/'));
      next();
    },()=>resolve(found));
    next();
  });
}
async function dropUpload(event){
  event.preventDefault();
  event.currentTarget?.classList.remove('dragging');
  const entries=[...(event.dataTransfer?.items||[])].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  if(!entries.length){await chooseUploadFiles(event.dataTransfer?.files||[]);return}
  const nested=await Promise.all(entries.map(entry=>droppedEntries(entry)));
  await uploadFiles(nested.flat());
}
async function previewUpload(payload){
  const dialog=installDialog,version=++dialog.version;
  dialog.found=false;dialog.finding=true;dialog.candidates=[];dialog.upload=null;
  $('installError').textContent='';$('installSkipped').hidden=true;$('uploadNote').hidden=true;$('installationDiscovery').innerHTML='';
  installationPicker={kind:'installation',selected:new Set(),names:[]};
  updateInstallationSelection();
  const current=()=>installDialog===dialog&&version===dialog.version&&$('sheet').open;
  try{
    const {upload,candidates}=await request('kit/upload-preview',payload);
    if(!current())return;
    dialog.upload=upload;dialog.candidates=candidates;dialog.found=true;
    const owned=candidates.filter(item=>item.state==='tool');
    $('installSkipped').hidden=!owned.length;
    $('installSkipped').textContent=owned.length?`Left out because a tool installs them: ${owned.map(item=>`${item.name} (${item.tool})`).join(', ')}.`:'';
    const available=candidates.filter(item=>item.state!=='tool').sort((a,b)=>byName(a.name,b.name));
    $('uploadNote').hidden=!available.length;
    installationPicker={kind:'installation',rowExtra:installRowExtra};
    renderMembers(available.map(item=>item.name),'Skills found',false,available.length===1?[available[0].name]:[],Object.fromEntries(available.map(item=>[item.name,item.description])),installationPicker);
  }catch(error){if(current())$('installError').textContent=error.message}
  finally{if(current()){dialog.finding=false;updateInstallationSelection()}}
}
function installSourceChanged(){
  const dialog=installDialog;
  dialog.version++;dialog.found=false;dialog.finding=false;dialog.candidates=[];dialog.selected=[];
  installationPicker.selected=new Set();
  $('installationDiscovery').innerHTML='';$('installSkipped').hidden=true;$('installError').textContent='';
  updateInstallationSelection();
}
async function findInstallSkills(){
  const dialog=installDialog,source=$('installSource').value.trim(),version=++dialog.version;
  if(!validSource(source)){$('installError').textContent='Enter a repository URL or owner/repository.';$('installSource').focus();return}
  dialog.source=source;dialog.finding=true;$('installError').textContent='';$('findInstallSkills').disabled=true;$('findInstallSkills').textContent='Finding…';updateInstallationSelection();
  const current=()=>installDialog===dialog&&version===dialog.version&&$('sheet').open;
  try{
    const {candidates}=await request('kit/install-preview',{source});
    if(!current())return;
    dialog.candidates=candidates;dialog.found=true;
    const owned=candidates.filter(item=>item.state==='tool');
    $('installSkipped').hidden=!owned.length;
    $('installSkipped').textContent=owned.length?`Left out because a tool installs them: ${owned.map(item=>`${item.name} (${item.tool})`).join(', ')}.`:'';
    const available=candidates.filter(item=>item.state!=='tool');
    const preselected=dialog.selected.length?dialog.selected:available.length===1?[available[0].name]:[];
    const checked=preselected.filter(name=>available.some(item=>item.name===name&&item.state!=='conflict'));
    installationPicker={kind:'installation',rowExtra:installRowExtra};
    renderMembers(available.map(item=>item.name),'Skills in this repository',false,checked,Object.fromEntries(available.map(item=>[item.name,item.description])),installationPicker,Object.fromEntries(available.filter(item=>item.path).map(item=>[item.name,item.path])));
  }catch(error){if(current())$('installError').textContent=error.message}
  finally{if(current()){dialog.finding=false;$('findInstallSkills').disabled=false;$('findInstallSkills').textContent='Find skills';updateInstallationSelection()}}
}
function installRowExtra(name){
  const item=installDialog.candidates.find(candidate=>candidate.name===name);
  if(!item)return '';
  const notes=[];
  if(installDialog.kind==='file'){
    notes.push(`<small class="member-description">${countOf(item.files,'file')} · ${uploadSize(item.bytes)}</small>`);
    if(item.state==='installed')notes.push(`<small class="install-warning">Installed${item.installedFrom?` from ${esc(item.installedFrom)}`:''}. Installing replaces it.</small>`);
    return notes.join('');
  }
  if(item.state==='conflict')notes.push(`<small class="install-warning">${installDialog.to==='pack'?`Installed from ${esc(item.installedFrom||'an unknown source')}. The pack uses that copy.`:`Installed from ${esc(item.installedFrom||'an unknown source')}. Installing replaces it.`}</small>`);
  if(item.state==='installed')notes.push('<small class="member-description">Already installed</small>');
  if(item.inKit)notes.push(`<small class="member-description">In ${esc(item.inKit)}</small>`);
  return notes.join('')+`<details class="install-read" ontoggle="readInstallSkill(this,'${esc(name)}')"><summary>Read SKILL.md</summary><pre>Loading…</pre></details>`;
}
async function readInstallSkill(element,name){
  if(!element.open||element.dataset.loaded)return;
  element.dataset.loaded='true';
  const output=element.querySelector('pre');
  try{output.textContent=(await request('kit/install-read',{source:installDialog.source,name})).content}
  catch(error){output.textContent=error.message;delete element.dataset.loaded}
}
function setInstallDestination(value){
  installDialog.to=value;saveInstallPrefs({to:value});
  renderInstallTarget();
  if(installDialog.found)renderMemberList();else updateInstallationSelection();
}
function renderInstallTarget(){
  const host=$('installTarget'),dialog=installDialog;
  if(!host)return;
  if(dialog.to==='pack'){
    const options=[...profiles].sort((a,b)=>byName(a.name,b.name)).map(pack=>`<option value="${esc(pack.id)}" ${dialog.packTarget===pack.id?'selected':''}>${esc(pack.name)}</option>`).join('');
    host.innerHTML=`<label>Pack<select id="installPack" onchange="setInstallPack(this.value)"><option value="" ${dialog.packTarget?'':'selected'}>Choose a pack…</option>${options}<option value="new-pack" ${dialog.packTarget==='new-pack'?'selected':''}>New pack…</option></select></label><label id="installPackNameField" ${dialog.packTarget==='new-pack'?'':'hidden'}>New pack name<input id="installPackName" maxlength="120" oninput="updateInstallationSelection()"></label>`;
  }else if(dialog.to==='machine'&&projects.length){
    host.innerHTML=`<label>Install into<select id="installScope" onchange="installDialog.scope=this.value;updateInstallationSelection()">${scopeOptions(dialog.scope)}</select></label><p class="hint">A project install stays with that project and outside your kit.</p>`;
  }else host.innerHTML='';
}
function setInstallPack(value){
  installDialog.packTarget=value;
  $('installPackNameField').hidden=value!=='new-pack';
  updateInstallationSelection();
}
function installTargetReady(){
  const dialog=installDialog;
  if(dialog.to!=='pack')return Boolean(dialog.to);
  if(dialog.packTarget==='new-pack')return Boolean($('installPackName')?.value.trim());
  return Boolean(dialog.packTarget);
}
function installAction(){
  const dialog=installDialog,count=installationPicker.selected?.size||0,skills=countOf(count,'skill');
  if(dialog.finished)return {label:'Done',ready:false};
  if(dialog.running)return {label:'Working…',ready:false};
  if(!dialog.to)return {label:'Choose where it goes',ready:false};
  if(dialog.to==='later'){
    const hasSource=validSource($('installSource')?.value.trim()||dialog.source);
    return {label:count?`Bookmark ${skills}`:'Bookmark repository',ready:hasSource&&!dialog.finding};
  }
  if(!dialog.found||!count)return {label:'Choose skills',ready:false};
  if(!installTargetReady())return {label:'Choose a pack',ready:false};
  const label={core:`Install ${skills} to Core`,pack:`Add ${skills} to the pack`,machine:dialog.scope==='Global'?`Install ${skills} here`:`Install ${skills} in ${dialog.scope}`}[dialog.to];
  return {label,ready:true};
}
function updateInstallationSelection(){
  const control=$('startInstall');
  if(!control||!installDialog)return;
  const {label,ready}=installAction();
  control.textContent=label;control.disabled=!ready;
}
function installPayload(){
  const dialog=installDialog,names=[...(installationPicker.selected||[])];
  if(dialog.kind==='file'){
    const replace=dialog.candidates.filter(item=>item.state==='installed'&&names.includes(item.name)).map(item=>item.name),target=dialog.to==='pack'?dialog.packTarget:dialog.to;
    return {upload:dialog.upload,names,to:target,...(target==='new-pack'?{packName:$('installPackName').value.trim()}:{}),...(replace.length?{replace}:{})};
  }
  const conflicts=dialog.candidates.filter(item=>item.state==='conflict'&&names.includes(item.name)).map(item=>item.name);
  const packId=dialog.to==='pack'?dialog.packTarget:undefined;
  return {
    source:$('installSource')?.value.trim()||dialog.source,names,to:packId||dialog.to,
    ...(packId==='new-pack'?{packName:$('installPackName').value.trim()}:{}),
    ...(dialog.to==='machine'&&dialog.scope!=='Global'?{scope:dialog.scope}:{}),
    ...(dialog.to!=='later'&&dialog.to!=='pack'?{agent:$('installAgent')?.value||installAgentChoice()}:{}),
    ...(conflicts.length&&dialog.to!=='pack'&&dialog.to!=='later'?{replace:conflicts}:{}),
  };
}
function installElapsed(progress){
  const seconds=Math.max(0,Math.floor(((progress.finishedAt||Date.now())-(progress.startedAt||Date.now()))/1000));
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function renderInstallProgress(progress){
  const output=$('installOutput');
  if(!output||!progress)return;
  if(!output.querySelector('details'))output.innerHTML='<p class="install-phase"></p><p class="meta install-detail"></p><p class="meta install-last-line"></p><details><summary>Skills CLI output</summary><pre></pre></details>';
  output.querySelector('.install-phase').textContent=progress.phase;
  const detail=output.querySelector('.install-detail');
  if(detail)detail.textContent=[progress.item,progress.startedAt?installElapsed(progress):''].filter(Boolean).join(' · ');
  const last=output.querySelector('.install-last-line');
  if(last)last.textContent=progress.pending?progress.lastLine||'':'';
  output.querySelector('pre').textContent=progress.output||'Preparing…';
  if(!progress.pending&&progress.code)output.querySelector('details').open=true;
}
async function applyInstallSkills(){
  const dialog=installDialog;
  if(!installAction().ready)return;
  const payload=installPayload();
  dialog.running=true;$('installError').textContent='';updateInstallationSelection();
  const uploading=dialog.kind==='file',installs=!uploading&&['core','machine'].includes(payload.to);
  if($('cancelInstall'))$('cancelInstall').hidden=!installs;
  const timer=installs?setInterval(()=>request('skills/install-state',{}).then(progress=>{if(progress?.pending)renderInstallProgress(progress)}).catch(()=>{}),1000):undefined;
  try{
    const result=await request(uploading?'kit/upload-install':'kit/install',payload);
    if(result.install)renderInstallProgress(result.install);
    await refresh();
    if(result.ok){
      dialog.finished=true;
      const messages={core:'In your kit. Other machines will see it as missing until they sync.',machine:'Installed. It stays off your kit.',later:'Saved to Try later. Nothing was installed.'};
      const uploaded={core:'Saved in your library and added to Core. It is in your backup.',machine:'Installed on this machine only. It stays out of your library.'};
      const message=uploading?uploaded[payload.to]||'Saved in your library and added to the pack. Turning the pack on needs no download.':messages[payload.to]||'Added to the pack. Its skills are downloaded, and the pack stays on or off as it was.';
      if($('installOutput'))$('installOutput').insertAdjacentHTML('beforeend',`<p><strong>${esc(message)}</strong></p>`);
      toast(message);
    }else if($('installError'))$('installError').textContent='Installation stopped, so nothing was added to your kit. Review the output, then retry.';
  }catch(error){if($('installError'))$('installError').textContent=error.message}
  finally{
    clearInterval(timer);dialog.running=false;
    if($('cancelInstall'))$('cancelInstall').hidden=true;
    updateInstallationSelection();
  }
}
async function cancelInstallSkills(){
  const control=$('cancelInstall');
  if(control)control.disabled=true;
  try{const result=await request('skills/install-cancel',{});if(!result.cancelled)toast(result.reason)}
  catch(error){toast(error.message)}
  finally{if(control)control.disabled=false}
}
