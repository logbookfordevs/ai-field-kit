const installDestinations=[['core','Core','Install now, on every machine'],['pack','A pack','Ready, on when you need it'],['machine','This machine','Install, never travels'],['later','Try later','Bookmark, no install']];
let installDialog,installationPicker;
function installPrefs(){try{return JSON.parse(localStorage.getItem('afk.install'))||{}}catch{return {}}}
function saveInstallPrefs(patch){try{localStorage.setItem('afk.install',JSON.stringify({...installPrefs(),...patch}))}catch{/* Preferences are a convenience; private modes can refuse them. */}}
function installAgentChoice(){return installPrefs().agent||'universal'}
function showInstallSkills({source='',to,selected=[],scope:installScope='Global'}={}){
  const prefs=installPrefs();
  installDialog={source,selected,to:to||prefs.to||'',packTarget:profiles.length?'':'new-pack',scope:installScope,candidates:[],version:0,finding:false,found:false,running:false,finished:false};
  installationPicker={kind:'installation',selected:new Set(),names:[]};
  const destinations=installDestinations.map(([value,label,hint])=>`<label class="install-destination"><input type="radio" name="installTo" value="${value}" ${installDialog.to===value?'checked':''} onchange="setInstallDestination('${value}')"><span><strong>${label}</strong><small>${hint}</small></span></label>`).join('');
  const agents=['universal','codex','claude-code','cursor','opencode'].map(value=>`<option value="${value}" ${installAgentChoice()===value?'selected':''}>${value==='universal'?'Universal · .agents/skills':value}</option>`).join('');
  modal('Install skills',`<div class="install-source"><label>Repository<input id="installSource" value="${esc(source)}" placeholder="owner/repository or URL" oninput="installSourceChanged()" onkeydown="if(event.key==='Enter'){event.preventDefault();findInstallSkills()}"></label>${button('Find skills','findInstallSkills()','','id="findInstallSkills"')}</div><p id="installSkipped" class="hint" hidden></p><div id="installationDiscovery"></div><fieldset class="profile-source"><legend>Where should they go?</legend><div class="install-destinations">${destinations}</div></fieldset><div id="installTarget"></div><details class="source-options"><summary>Installation agent</summary><label>Agent<select id="installAgent" onchange="saveInstallPrefs({agent:this.value})">${agents}</select></label></details><div id="installOutput" role="status" aria-live="polite"></div><p id="installError" class="field-error" role="alert"></p>`,button('Cancel installation','cancelInstallSkills()','text danger','id="cancelInstall" hidden')+button('Close','closeModal()','text')+button('Install','applyInstallSkills()','primary','id="startInstall" disabled'));
  renderInstallTarget();
  updateInstallationSelection();
  request('skills/install-state',{}).then(progress=>{if(progress?.pending)renderInstallProgress(progress)}).catch(()=>{});
  if(source)findInstallSkills();
}
function installFromSource(index,to){
  const source=favoriteSources[index];
  if(source)showInstallSkills({source:source.source,to,selected:source.skills||[]});
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
  const installs=['core','machine'].includes(payload.to);
  if($('cancelInstall'))$('cancelInstall').hidden=!installs;
  const timer=installs?setInterval(()=>request('skills/install-state',{}).then(progress=>{if(progress?.pending)renderInstallProgress(progress)}).catch(()=>{}),1000):undefined;
  try{
    const result=await request('kit/install',payload);
    if(result.install)renderInstallProgress(result.install);
    await refresh();
    if(result.ok){
      dialog.finished=true;
      const messages={core:'In your kit. Other machines will see it as missing until they sync.',machine:'Installed. It stays off your kit.',later:'Saved to Try later. Nothing was installed.'};
      const message=messages[payload.to]||'Added to the pack. Its skills are downloaded, and the pack stays on or off as it was.';
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
