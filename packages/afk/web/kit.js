let kitStatus={core:[],sources:[],tools:[],undecided:[],machineOnly:[],plan:{install:[],enable:[],tools:[]}},migrationRequired=false,kitTab='machine',kitUpstream;
const kitDisclosures=new Map();
function setKitDisclosure(key,open){kitDisclosures.set(key,open)}
function kitDisclosureAttrs(key,openByDefault=false){return `data-kit-disclosure="${esc(key)}" ontoggle="setKitDisclosure(this.dataset.kitDisclosure,this.open)" ${kitDisclosures.get(key)??openByDefault?'open':''}`}
function countOf(count,word){return count+" "+word+(count===1?"":"s")}
function planCount(plan=kitStatus.plan){return plan.install.reduce((total,group)=>total+group.skills.length,0)+plan.enable.length+plan.tools.reduce((total,tool)=>total+tool.skills.length,0)}
function kitAttention(){return kitStatus.undecided.length+planCount()}
function sourceLabel(source){return source.trim().replace(/^https?:\/\/github\.com\//,'').replace(/^git@github\.com:/,'').replace(/\.git$/,'').replace(/\/+$/,'')}
function kitSourceHeading(source,count){return `<div class="kit-source"><h3 title="${esc(source)}">${esc(sourceLabel(source))}</h3><span class="meta">${countOf(count,'skill')}</span></div>`}
function kitSourceLink(source){
  const url=sourceWebUrl(source),label=esc(sourceLabel(source));
  return url?`<a class="kit-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(source)}">${label}<span aria-hidden="true"> ↗</span><span class="sr-only"> (opens in a new tab)</span></a>`:`<span class="kit-source-link" title="${esc(source)}">${label}</span>`;
}
function setKitTab(tab){kitTab=tab;renderKit();$('kitTab-'+tab)?.focus()}
function kitTabKey(event){
  const order=['machine','core','packs','later'],at=order.indexOf(kitTab);
  const next={ArrowRight:order[(at+1)%order.length],ArrowLeft:order[(at+order.length-1)%order.length],Home:order[0],End:order[order.length-1]}[event.key];
  if(!next)return;
  event.preventDefault();setKitTab(next);
}
function kitTabs(){
  const tabs=[['machine','This machine',kitAttention()||''],['core','Core',kitStatus.core.length],['packs','Packs',profiles.length],['later','Try later',favoriteSources.length]];
  return `<div class="page-tabs" role="tablist" aria-label="Your kit">${tabs.map(([id,label,count])=>`<button type="button" role="tab" id="kitTab-${id}" aria-selected="${kitTab===id}" aria-controls="kitPanel" tabindex="${kitTab===id?0:-1}" onclick="setKitTab('${id}')" onkeydown="kitTabKey(event)">${label} <span class="meta">${count}</span></button>`).join('')}</div>`;
}
function renderKit(){
  const pending=planCount()>0;
  const action=`<div class="inline">${button('Install skills','showInstallSkills()','','data-od-id="install-skills"')}${button(pending?`Sync this machine · ${planCount()}`:'Nothing to sync','reviewSync()','primary',pending?'data-od-id="sync-machine"':'disabled data-od-id="sync-machine"')}</div>`;
  const panels={machine:renderMachinePanel,core:renderCorePanel,packs:renderPacksPanel,later:renderSourcesPanel};
  $('view').innerHTML=head('Kit','The skills that travel with you, compared with this machine.',action)+kitTabs()+`<div id="kitPanel" role="tabpanel" aria-labelledby="kitTab-${kitTab}">${panels[kitTab]()}</div>`;
  if(kitTab==='later')renderSourceList();
}
function undecidedActions(item){
  const name=esc(item.name);
  const keep=button('This machine only',`keepOnMachine('${name}')`,'text');
  if(!item.installable)return button('Link to a tool…',`linkToTool('${name}')`)+keep;
  return button('Core',`addToKit('${name}','core')`)+button('Pack…',`addToPack('${name}')`)+keep+button('Remove',`removeFromMachine('${name}')`,'text danger');
}
function undecidedGroups(){
  const groups=new Map();
  for(const item of kitStatus.undecided){
    const key=item.installable?sourceLabel(item.source).toLowerCase():'';
    const group=groups.get(key)||{source:item.installable?item.source:'',items:[]};
    group.items.push(item);groups.set(key,group);
  }
  return [...groups].sort(([a],[b])=>(a===''?1:0)-(b===''?1:0)||a.localeCompare(b)).map(([,group])=>[group.source,group.items]);
}
function renderUndecided(){
  if(!kitStatus.undecided.length)return '';
  const groups=undecidedGroups().map(([source,items])=>{
    const title=source?kitSourceHeading(source,items.length):`<div class="kit-source"><h3>No repository source</h3><span class="meta">Another machine can’t install these, unless a tool brings them.</span></div>`;
    const all=source&&items.length>1?button('Add all to Core',`addToKit(${esc(JSON.stringify(items.map(item=>item.name)))},'core')`,'text'):'';
    return `<section class="kit-group"><div class="kit-group-head">${title}${all}</div>${items.map(item=>`<div class="kit-row"><div class="kit-row-name"><code>${esc(item.name)}</code></div><div class="kit-actions">${undecidedActions(item)}</div></div>`).join('')}</section>`;
  }).join('');
  return `<section class="kit-section" data-od-id="kit-undecided"><h2>Not in your kit</h2><p class="sub">Installed here, but not going anywhere with you yet. Decide once and AFK stops asking.</p>${groups}</section>`;
}
function renderMissing(){
  const missing=kitStatus.core.filter(item=>item.status==='missing');
  const off=kitStatus.core.filter(item=>item.status==='off');
  const tools=kitStatus.tools.filter(tool=>tool.missing.length);
  if(!missing.length&&!off.length&&!tools.length)return '';
  const rows=[
    ...missing.map(item=>`<div class="kit-row"><div class="kit-row-name"><code>${esc(item.name)}</code><span class="meta">${esc(sourceLabel(item.source))}</span></div><div class="kit-actions">${kitCatchUpButton(item.name,'Install')}${button('Drop from kit',`dropFromKit('${esc(item.name)}','core')`,'text')}</div></div>`),
    ...off.map(item=>`<div class="kit-row"><div class="kit-row-name"><code>${esc(item.name)}</code><span class="meta">Installed, turned off here</span></div><div class="kit-actions">${kitCatchUpButton(item.name,'Turn on')}${button('Drop from kit',`dropFromKit('${esc(item.name)}','core')`,'text')}</div></div>`),
    ...tools.map(tool=>`<div class="kit-row"><div class="kit-row-name"><strong>${esc(tool.name)}</strong><span class="meta">Brings ${tool.missing.map(esc).join(', ')}</span></div><div class="kit-actions">${button('Run install command',`runTool(${tool.id},false)`)}</div></div>`),
  ].join('');
  const catchUp=missing.length+off.length+tools.length>1?button('Install all…','reviewSync()','text'):'';
  return `<section class="kit-section" data-od-id="kit-missing"><div class="kit-group-head"><h2>Missing here</h2>${catchUp}</div><p class="sub">In your kit, but not ready on this machine.</p><section class="kit-group">${rows}</section></section>`;
}
function renderUpstream(){
  if(!kitStatus.sources.some(source=>source.follow))return '';
  const offers=kitUpstream?.sources||[];
  const rows=offers.map(entry=>entry.error
    ?`<section class="kit-group"><div class="kit-group-head"><div class="kit-source"><h3 title="${esc(entry.source)}">${esc(sourceLabel(entry.source))}</h3></div></div><p class="field-error" role="status">${esc(entry.error)}</p></section>`
    :`<section class="kit-group"><div class="kit-group-head">${kitSourceHeading(entry.source,entry.names.length)}</div>${entry.names.map(name=>`<div class="kit-row"><div class="kit-row-name is-stacked"><code>${esc(name)}</code>${entry.descriptions?.[name]?`<span class="meta kit-row-note" title="${esc(entry.descriptions[name])}">${esc(entry.descriptions[name])}</span>`:''}</div><div class="kit-actions">${button('Add to Core',`acceptUpstream(${kitUpstream.sources.indexOf(entry)},'${esc(name)}')`)}</div></div>`).join('')}</section>`).join('');
  const checked=kitUpstream&&!offers.length?'<p class="sub">No new skills in the repositories you follow.</p>':'';
  return `<section class="kit-section" data-od-id="kit-following"><div class="kit-group-head"><h2>New from sources you follow</h2><div class="kit-actions">${kitUpstream&&kitUpstream!=='loading'?button('Clear','clearUpstream()','text'):''}${button(kitUpstream==='loading'?'Checking…':'Check now','checkUpstream()','text',kitUpstream==='loading'?'disabled':'')}</div></div>${checked}${rows}</section>`;
}
function renderMachinePanel(){
  const sections=renderUndecided()+renderMissing()+renderUpstream();
  const clear=!kitAttention()?`<div class="kit-clear"><h2>${kitStatus.core.length||kitStatus.tools.length?'This machine matches your kit':'Your kit is empty'}</h2><p class="sub">${kitStatus.core.length||kitStatus.tools.length?'Everything in Core is installed and on.':'Use Install skills to start, or install them your usual way and they’ll appear here for you to sort.'}</p></div>`:'';
  const local=kitStatus.machineOnly.length?`<details class="section-help" ${kitDisclosureAttrs('machine-only')}><summary>${countOf(kitStatus.machineOnly.length,'skill')} kept on this machine only</summary>${kitStatus.machineOnly.map(name=>`<div class="kit-row"><div class="kit-row-name"><code>${esc(name)}</code></div><div class="kit-actions">${button('Ask again',`keepOnMachine('${esc(name)}',false)`,'text')}</div></div>`).join('')}</details>`:'';
  return clear+sections+local;
}
function renderCorePanel(){
  const status={on:'',off:'Off here',missing:'Missing here'};
  const groups=kitStatus.sources.map((source,index)=>{
    const items=kitStatus.core.filter(item=>item.source===source.source);
    const follow=button(source.follow?'Following · stop':'Follow new skills',`toggleFollow(${index})`,'text');
    const issues=items.filter(item=>item.status!=='on').length;
    const summary=`${esc(source.name||sourceLabel(source.source))} <span class="meta">${countOf(items.length,'skill')}${issues?` · ${issues} not ready here`:''}${source.follow?' · following':''}</span>`;
    return `<details class="kit-group" ${kitDisclosureAttrs(source.source,issues>0)}><summary>${summary}</summary><div class="kit-group-head">${kitSourceLink(source.source)}${follow}</div>${items.map(item=>`<div class="kit-row"><div class="kit-row-name"><code>${esc(item.name)}</code>${status[item.status]?`<span class="meta">${status[item.status]}</span>`:''}</div><div class="kit-actions">${button('Drop',`dropFromKit('${esc(item.name)}','core')`,'text')}</div></div>`).join('')}</details>`;
  }).join('');
  const tools=kitStatus.tools.length?`<section class="kit-section"><h2>From your tools</h2><p class="sub">These tools install and update their own skills. Your kit tracks the tool.</p><section class="kit-group">${kitStatus.tools.map(tool=>`<div class="kit-row"><div class="kit-row-name"><strong>${esc(tool.name)}</strong><span class="meta">${tool.provides.map(esc).join(', ')}</span></div><div class="kit-actions">${button('Open in Tools',"navigate('Tools')",'text')}</div></div>`).join('')}</section></section>`:'';
  const empty=kitStatus.sources.length?'':'<div class="empty"><h2>Core is empty</h2><p class="sub">Core is what you want on every machine, always on. Add skills you’ve installed from This machine, or choose them from a repository.</p></div>';
  const actions=`<div class="inline kit-panel-actions">${kitStatus.core.length?button('Export JSON',"exportPack('core')",'text'):''}${button('Install skills',"showInstallSkills({to:'core'})")}</div>`;
  return actions+empty+(groups?`<section class="kit-section">${groups}</section>`:'')+tools;
}
const kitCatchingUp=new Set();
function kitCatchUpButton(name,label){
  const busy=kitCatchingUp.has(name);
  return button(busy?'Working…':label,`catchUpSkill('${esc(name)}')`,'',busy?'disabled':'');
}
async function catchUpSkill(name){
  if(kitCatchingUp.has(name))return;
  kitCatchingUp.add(name);
  if(section==='Kit')renderKit();
  try{
    const result=await request('kit/sync',{expected:kitStatus.plan,only:[name],agent:installAgentChoice()});
    const failed=result.enabled.find(item=>!item.ok);
    if(result.install?.code){
      modal('Could not install '+esc(name),`<p>Skills CLI stopped. Review its output, then retry.</p><pre>${esc(result.install.output||result.install.phase)}</pre>`,button('Close','closeModal()'));
    }else if(failed)toast(failed.error);
    else toast(name+' is ready on this machine.');
  }catch(error){toast(error.message)}
  finally{kitCatchingUp.delete(name);await refresh().catch(error=>toast(error.message))}
}
function addToKit(names,to){
  const list=Array.isArray(names)?names:[names];
  return operation(async()=>{await request('kit/add',{names:list,to});toast(`Added to ${to==='core'?'Core':'the pack'}. Other machines will see ${list.length===1?'it':'them'} as missing.`)});
}
function addToPack(name){
  if(!profiles.length){toast('Create a pack first, in the Packs tab.');return}
  const options=[...profiles].sort((a,b)=>byName(a.name,b.name)).map(pack=>`<label class="check"><input type="radio" name="kitPack" value="${esc(pack.id)}"><span>${esc(pack.name)}</span></label>`).join('');
  modal('Add '+esc(name)+' to a pack',`<fieldset class="profile-source"><legend>Pack</legend>${options}</fieldset><p id="kitError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Add to pack',`confirmAddToPack('${esc(name)}')`,'primary'));
}
function confirmAddToPack(name){
  const choice=document.querySelector('input[name=kitPack]:checked');
  if(!choice){$('kitError').textContent='Choose a pack.';return}
  return saveForm(()=>request('kit/add',{names:[name],to:choice.value}),'Added to the pack.','kitError');
}
function keepOnMachine(name,enabled=true){return operation(()=>request('kit/machine-only',{name,enabled}))}
function dropFromKit(name,from){
  const open=$('sheet').open;
  return operation(async()=>{await request('kit/drop',{name,from});if(open)closeModal();toast(`${name} dropped. Its files stay on this machine.`)});
}
function removeFromMachine(name){scope='Global';return reviewSkillDeletion(name)}
function linkToTool(name){
  if(!tools.length){modal('Link '+esc(name)+' to a tool',`<p>Save the command that installs ${esc(name)} as a tool first. Then link it here, so your kit can bring it to other machines.</p>`,button('Cancel','closeModal()','text')+button('Add tool',"closeModal();navigate('Tools');editTool()",'primary'));return}
  const options=tools.map(tool=>`<label class="check"><input type="radio" name="kitTool" value="${tool.id}"><span>${esc(tool.name)}</span></label>`).join('');
  modal('Link '+esc(name)+' to a tool',`<p>Your kit then tracks the tool, and its install command brings ${esc(name)} to other machines.</p><fieldset class="profile-source"><legend>Tool</legend>${options}</fieldset><p id="kitError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Link',`confirmLinkToTool('${esc(name)}')`,'primary'));
}
function confirmLinkToTool(name){
  const choice=document.querySelector('input[name=kitTool]:checked');
  if(!choice){$('kitError').textContent='Choose a tool.';return}
  const id=Number(choice.value),next=currentSettings.tools.map(tool=>tool.id===id?{...tool,provides:[...new Set([...(tool.provides||[]),name])]}:tool);
  return saveForm(()=>savePatch({tools:next}),'Linked. Your kit now tracks this through the tool.','kitError');
}
function toggleFollow(index){
  const source=kitStatus.sources[index];
  return operation(()=>request('kit/follow',{source:source.source,follow:!source.follow}));
}
async function checkUpstream(){
  kitUpstream='loading';renderKit();
  try{kitUpstream=await request('kit/upstream',{})}
  catch(error){kitUpstream=undefined;toast(error.message)}
  if(section==='Kit'&&!migrationRequired)renderKit();
}
function clearUpstream(){kitUpstream=undefined;renderKit()}
function acceptUpstream(index,name){
  const entry=kitUpstream.sources[index];
  return operation(async()=>{
    await request('kit/add',{names:[name],to:'core',source:entry.source});
    entry.names=entry.names.filter(other=>other!==name);
    kitUpstream.sources=kitUpstream.sources.filter(item=>item.error||item.names.length);
  });
}
let syncReview;
function reviewSync(){
  const plan=kitStatus.plan;
  if(!planCount())return;
  syncReview=plan;
  const install=plan.install.map(group=>`<section><h3><code class="path">${esc(group.source)}</code></h3><ul>${group.skills.map(name=>`<li><code>${esc(name)}</code></li>`).join('')}</ul></section>`).join('');
  const enable=plan.enable.length?`<section><h3>Turn back on</h3><ul>${plan.enable.map(name=>`<li><code>${esc(name)}</code></li>`).join('')}</ul></section>`:'';
  const toolRows=plan.tools.map(tool=>`<section class="sync-tool"><label class="check"><input type="checkbox" data-sync-tool="${tool.id}"><span>Run ${esc(tool.name)}’s install command, for ${tool.skills.map(esc).join(', ')}</span></label><pre>$ ${esc(tool.command)}</pre></section>`).join('');
  const toolIntro=plan.tools.length?'<p class="hint">Saved commands can do anything your account can. They only run if you tick them.</p>':'';
  const agent=plan.install.length?`<label>Installation agent<select id="syncAgent">${['universal','codex','claude-code','cursor','opencode'].map(value=>`<option value="${value}">${value==='universal'?'Universal · .agents/skills':value}</option>`).join('')}</select></label>`:'';
  modal('Sync this machine',`<div class="sync-plan"><p>This brings this machine in line with your kit. Skills that aren’t in your kit are left alone.</p>${install}${enable}${toolIntro}${toolRows}${agent}</div><div id="syncOutput" role="status" aria-live="polite"></div><p id="syncError" class="field-error" role="alert"></p>`,button('Close','closeModal()','text')+button('Sync','applySync()','primary','id="startSync"'));
}
async function applySync(){
  const expected=syncReview,control=$('startSync');
  if(!expected||control.disabled)return;
  const runTools=[...document.querySelectorAll('[data-sync-tool]:checked')].map(input=>Number(input.dataset.syncTool));
  const agent=$('syncAgent')?.value;
  control.disabled=true;control.textContent='Syncing…';$('syncError').textContent='';$('syncOutput').innerHTML='<p>Syncing. Closing this dialog does not stop it.</p>';
  try{
    const result=await request('kit/sync',{expected,runTools,...(agent?{agent}:{})});
    await refresh();
    const failedInstall=Boolean(result.install?.code);
    const lines=[
      ...(result.install?[`<p><strong>${esc(result.install.phase)}</strong></p>${result.install.output?`<details ${failedInstall?'open':''}><summary>Skills CLI output</summary><pre>${esc(result.install.output)}</pre></details>`:''}`]:[]),
      ...result.enabled.filter(item=>!item.ok).map(item=>`<p class="field-error">${esc(item.name)}: ${esc(item.error)}</p>`),
      ...result.tools.map(tool=>`<details ${tool.code?'open':''}><summary>${esc(tool.name)} · exit ${tool.code}</summary><pre>${esc(tool.output)}</pre></details>`),
      ...result.skippedTools.map(tool=>`<p class="hint">${esc(tool.name)} was not run.</p>`),
      `<p>${planCount(result.status.plan)?`${countOf(planCount(result.status.plan),'skill')} still different from your kit.`:'This machine matches your kit.'}</p>`,
    ];
    if($('syncOutput'))$('syncOutput').innerHTML=lines.join('');
    if(control.isConnected)control.textContent='Done';
  }catch(error){
    if($('syncError'))$('syncError').textContent=error.message;
    if($('syncOutput'))$('syncOutput').innerHTML='';
    if(control.isConnected){control.disabled=false;control.textContent='Sync'}
  }
}
let migrationChoice={core:null,follow:new Set(),skipTools:new Set()},migrationPreview,migrationVersion=0;
function renderMigration(){
  const stacks=currentSettings.stacks||[];
  const coreOptions=stacks.map(stack=>`<label class="check"><input type="radio" name="migrationCore" value="${esc(stack.manifest.id)}" ${migrationChoice.core===stack.manifest.id?'checked':''} onchange="setMigrationCore(this.value)"><span>${esc(stack.manifest.name)} <span class="meta">${countOf(stack.manifest.sources.reduce((total,group)=>total+group.skills.length,0),'skill')}</span></span></label>`).join('');
  const chosen=stacks.find(stack=>stack.manifest.id===migrationChoice.core);
  const follow=chosen?`<fieldset class="profile-source"><legend>Follow a repository · optional</legend><p class="hint">Skills you’ve installed from a followed repository join Core, and new ones are offered later.</p>${chosen.manifest.sources.map((group,index)=>`<label class="check"><input type="checkbox" ${migrationChoice.follow.has(group.source)?'checked':''} onchange="setMigrationFollow(${index},this.checked)"><span>${esc(group.name)} <code class="path">${esc(group.source)}</code></span></label>`).join('')}</fieldset>`:'';
  $('view').innerHTML=`<div class="migration">${head('Move to your kit','Stacks, profiles and bookmarks become one kit. Nothing is written until you confirm, and your old file is kept.')}<fieldset class="profile-source"><legend>Which stack do you want on every machine?</legend>${coreOptions}<label class="check"><input type="radio" name="migrationCore" value="" ${migrationChoice.core===null?'checked':''} onchange="setMigrationCore('')"><span>None for now</span></label><p class="hint">That stack becomes Core. The others become packs you turn on when you need them.</p></fieldset>${follow}<div id="migrationReport" class="migration-report"><p class="sub">Checking…</p></div><p id="migrationError" class="field-error" role="alert"></p><div class="inline">${button('Move to my kit','applyMigration()','primary','id="applyMigration" disabled')}</div></div>`;
  loadMigrationPreview();
}
function setMigrationCore(value){migrationChoice.core=value||null;migrationChoice.follow.clear();renderMigration()}
function setMigrationFollow(index,checked){
  const stack=(currentSettings.stacks||[]).find(item=>item.manifest.id===migrationChoice.core),source=stack.manifest.sources[index].source;
  if(checked)migrationChoice.follow.add(source);else migrationChoice.follow.delete(source);
  loadMigrationPreview();
}
function setMigrationTool(name,linked){
  if(linked)migrationChoice.skipTools.delete(name);else migrationChoice.skipTools.add(name);
  loadMigrationPreview();
}
function migrationPayload(){return {core:migrationChoice.core,follow:[...migrationChoice.follow],skipTools:[...migrationChoice.skipTools]}}
async function loadMigrationPreview(){
  const version=++migrationVersion;
  try{
    const preview=await request('migration/preview',migrationPayload());
    if(version!==migrationVersion||!$('migrationReport'))return;
    migrationPreview=preview;
    $('migrationReport').innerHTML=migrationReportHtml(preview.report);
    $('applyMigration').disabled=false;
  }catch(error){if(version===migrationVersion&&$('migrationError'))$('migrationError').textContent=error.message}
}
function migrationReportHtml(report){
  const coreCount=report.core.reduce((total,entry)=>total+entry.skills.length,0);
  const list=items=>`<ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul>`;
  return `<h3>What will change</h3>${list([...report.stacks.map(stack=>`${esc(stack.name)} → ${stack.becomes==='core'?'Core':'a pack'}`),`Core: ${countOf(coreCount,'skill')}`,`Packs: ${report.packs.map(pack=>esc(pack.name)).join(', ')||'none'}`])}${report.added.length?`<h3>Joining Core from repositories you follow</h3><p><code>${report.added.map(item=>esc(item.name)).join(', ')}</code></p>`:''}${report.missingHere.length?`<h3>In Core, missing on this machine</h3><p><code>${report.missingHere.map(esc).join(', ')}</code></p>`:''}${report.tools.length?`<h3>Skills your tools bring</h3><fieldset class="profile-source">${report.tools.map(tool=>`<label class="check"><input type="checkbox" ${tool.linked?'checked':''} onchange="setMigrationTool(${esc(JSON.stringify(tool.name))},this.checked)"><span>${esc(tool.name)} <code>${tool.provides.map(esc).join(', ')}</code></span></label>`).join('')}</fieldset>`:''}<h3>Staying exactly as they are</h3><p>${countOf(report.preserved.sources,'bookmark')}, ${countOf(report.preserved.tools,'tool')}, ${countOf(report.preserved.projects,'project')}, ${countOf(report.preserved.rulesDestinations,'rule destination')}, which packs are on, and invocation preferences. No skill files move.</p>${report.dropped.savedSkills?`<h3>Retired</h3><p>Your saved skills list stays only in the kept copy of the old file.</p>`:''}${report.warnings.length?`<h3>Check these</h3><ul>${report.warnings.map(warning=>`<li class="migration-warning">${esc(warning)}</li>`).join('')}</ul>`:''}<p class="hint">If this settings file is shared, update AFK on your other machines before using it there.</p>`;
}
async function applyMigration(){
  const control=$('applyMigration');
  if(!migrationPreview)return;
  control.disabled=true;$('migrationError').textContent='';
  try{
    const result=await request('migration/apply',{...migrationPayload(),fingerprint:migrationPreview.fingerprint});
    section='Kit';kitTab='machine';
    await refresh();
    toast(result.backup?`Moved to your kit. Old file kept at ${result.backup}`:'Moved to your kit.');
  }catch(error){$('migrationError').textContent=error.message;control.disabled=false}
}
