let skillsTab='core',skillsQuery='';
const skillsTabOrder=['core','packs','machine','later','review'];
const skillsTabLabels={core:'Core',packs:'Packs',machine:'This machine only',later:'Try later',review:'To review'};

function repositorySource(source){return Boolean(source)&&!/^(\/|~|\.|file:)/.test(source)}
function globalSkills(){return inventories.Global||[]}
function globalSkill(name){return globalSkills().find(entry=>entry.name===name)}
function skillsMatch(name){const needle=skillsQuery.trim().toLowerCase();return !needle||name.toLowerCase().includes(needle)}

function packSkillNames(){return new Set(profiles.flatMap(profile=>profile.skills))}
function toolSkillNames(){return new Set(tools.flatMap(tool=>tool.provides||[]))}
function libraryOnlySkills(){
  const placed=new Set([...kitStatus.core.map(item=>item.name),...packSkillNames(),...toolSkillNames()]);
  return globalSkills().filter(entry=>entry.storage==='library'&&!placed.has(entry.name));
}
function otherMachineSkills(){
  const placed=new Set([...kitStatus.core.map(item=>item.name),...packSkillNames(),...toolSkillNames(),...kitStatus.machineOnly,...kitStatus.undecided.map(item=>item.name),...libraryOnlySkills().map(entry=>entry.name)]);
  return globalSkills().filter(entry=>!placed.has(entry.name));
}

function skillsTabCount(tab){
  if(tab==='core')return kitStatus.core.length+libraryOnlySkills().length;
  if(tab==='packs')return profiles.length;
  if(tab==='machine')return kitStatus.machineOnly.length+otherMachineSkills().length;
  if(tab==='later')return favoriteSources.length;
  return kitStatus.undecided.length;
}

function setSkillsTab(tab){skillsTab=tab;renderKit();$('skillsTab-'+tab)?.focus()}
function skillsTabKey(event){
  const at=skillsTabOrder.indexOf(skillsTab),last=skillsTabOrder.length-1;
  const next={ArrowRight:skillsTabOrder[(at+1)%skillsTabOrder.length],ArrowLeft:skillsTabOrder[(at+last)%skillsTabOrder.length],Home:skillsTabOrder[0],End:skillsTabOrder[last]}[event.key];
  if(!next)return;
  event.preventDefault();setSkillsTab(next);
}
function skillsTabs(){
  return `<div class="page-tabs" role="tablist" aria-label="Skill groups">${skillsTabOrder.map(id=>{
    const selected=skillsTab===id;
    return `<button type="button" role="tab" id="skillsTab-${id}" aria-selected="${selected}" aria-controls="skillsPanel" tabindex="${selected?0:-1}" onclick="setSkillsTab('${id}')" onkeydown="skillsTabKey(event)">${skillsTabLabels[id]} <span class="meta">${skillsTabCount(id)}</span></button>`;
  }).join('')}</div>`;
}

function skillBackupState(entry){
  if((backupState?.attention||[]).some(item=>item.name===entry.name))return 'attention';
  if(entry.tool||entry.storage==='pack')return 'outside';
  if(entry.storage!=='library')return 'none';
  const status=backupState?.status;
  const pushed=status&&status.state!=='off'&&!(backupState.unpushed||[]).includes(entry.name);
  return pushed?'backed':'saved';
}
function skillBackupTitle(entry,state){
  if(state==='attention')return 'Changed on this machine. Review it in Backup.';
  if(state==='outside')return entry.tool?`${entry.tool} installs this skill. The tool is backed up, not these files.`:'The pack is backed up. Its skill files download again when it is turned on.';
  if(state==='none')return 'Stays on this machine. It is not in your library or backup.';
  if(state==='backed')return 'In your library and pushed to your backup.';
  return backupState?.status?.state==='off'?'Saved in your library. Backup is off, so nothing is pushed.':'Saved in your library. AFK pushes it shortly.';
}
function skillBackupChip(entry){
  const state=skillBackupState(entry);
  const label={backed:'Backed up',saved:'Saved · not pushed yet',attention:'Needs attention',outside:'Outside library',none:'Not in library'}[state];
  return `<span class="backup-chip" data-backup-chip="${esc(entry.name)}" data-state="${state}" title="${esc(skillBackupTitle(entry,state))}">${label}</span>`;
}
function refreshBackupChips(){
  if(typeof document==='undefined'||!document.querySelectorAll)return;
  document.querySelectorAll('[data-backup-chip]').forEach(chip=>{
    const entry=globalSkill(chip.dataset.backupChip);
    if(entry)chip.outerHTML=skillBackupChip(entry);
  });
}

function skillMenu(name,items){
  if(!items.length)return '';
  const id='skill-menu-'+encodeURIComponent(name);
  const buttons=items.map(([label,action,danger])=>`<button type="button" role="menuitem" ${danger?'class="danger"':''} onclick="this.closest('[popover]').hidePopover();${esc(action)}">${esc(label)}</button>`).join('');
  return `<button type="button" class="source-menu-trigger" popovertarget="${esc(id)}" aria-label="More actions for ${esc(name)}" aria-haspopup="menu">⋯</button><div id="${esc(id)}" class="skill-invoc-popover skills-folder-popover source-menu" popover role="menu">${buttons}</div>`;
}

function skillsRow(entry,{menu=[],note=''}={}){
  const name=esc(entry.name),held=entry.owners.length>0,busy=skillBulkBusy?'disabled':'';
  const tool=tools.find(item=>item.provides?.includes(entry.name));
  const hint=[preferenceHint(entry.name),invocationMechanismHint()].filter(Boolean).join(' ');
  const switchControl=`<button type="button" role="switch" class="switch" aria-checked="${entry.available}" ${held||skillBulkBusy?'disabled':''} aria-label="${name} on this machine" onclick="toggleSkill('${name}')" data-od-id="skill-${name}-switch"><span class="track" aria-hidden="true"></span><span>${entry.available?'On':'Off'}</span></button>`;
  const notes=[
    held?`<span class="hint">In ${entry.owners.map(esc).join(', ')} · turn the pack on or off in Packs</span>`:'',
    entry.duplicate?`<span class="hint duplicate-hint">Two copies ${button('Resolve',`showDuplicateChoice('${name}','Global')`,'text',busy)}</span>`:'',
  ].join('');
  const update=tool?button('Update',`runTool(${tool.id},true)`,'text',busy):button('Update',`showSkillUpdate('${name}')`,'text',busy);
  const menuItems=[...menu,...(tool?[]:[['Delete',`reviewSkillDeletion('${name}')`,true]])];
  return `<article class="skill-row row" data-od-id="skill-${name}">
    <div class="skill-name"><div><h3>${name}</h3><p class="skill-meta">${skillBackupChip(entry)}${note?`<span class="meta">${note}</span>`:''}</p></div></div>
    <div class="skill-avail">${switchControl}${notes}</div>
    <div class="skill-invoc">${invocationInfo(entry.name,hint)}${preferenceSelect(entry.name,busy)}${preferenceDriftNotice(entry.name)}</div>
    <div class="skill-actions">${update}${button('Inspect',`inspectSkill('${name}')`,'text',`data-od-id="skill-${name}-inspect"`)}${skillMenu(entry.name,menuItems)}</div>
  </article>`;
}
function skillsLedger(rows){return rows.length?`<div class="ledger skills skills-page">${rows.join('')}</div>`:''}

function coreItemRow(item){
  const entry=globalSkill(item.name),name=esc(item.name);
  const drop=['Drop from Core',`dropFromKit('${name}','core')`];
  if(entry)return skillsRow(entry,{menu:[['Add to pack…',`addToPack('${name}')`],drop]});
  return `<div class="kit-row"><div class="kit-row-name"><code>${name}</code><span class="meta">Missing on this machine</span></div><div class="kit-actions">${kitCatchUpButton(item.name,'Install')}${button('Drop from Core',`dropFromKit('${name}','core')`,'text')}</div></div>`;
}
function coreSourceGroup(source,index){
  const items=kitStatus.core.filter(item=>item.source===source.source&&skillsMatch(item.name));
  if(skillsQuery.trim()&&!items.length)return '';
  const all=kitStatus.core.filter(item=>item.source===source.source);
  const issues=all.filter(item=>item.status!=='on').length,installed=all.filter(item=>globalSkill(item.name));
  const follow=button(source.follow?'Following · stop':'Follow new skills',`toggleFollow(${index})`,'text');
  const update=installed.length?button('Update source',`showSkillUpdate(${esc(JSON.stringify(installed.map(item=>item.name)))})`,'text'):'';
  const summary=`${esc(source.name||sourceLabel(source.source))} <span class="meta">${countOf(all.length,'skill')}${issues?` · ${issues} not ready here`:''}${source.follow?' · following':''}</span>`;
  return `<details class="kit-group" ${kitDisclosureAttrs(source.source,issues>0||Boolean(skillsQuery.trim()))}><summary>${summary}</summary><div class="kit-group-head">${kitSourceLink(source.source)}<div class="kit-actions">${update}${follow}</div></div>${skillsLedger(items.map(coreItemRow))}</details>`;
}
function renderToolSkills(){
  if(!kitStatus.tools.length)return '';
  const groups=kitStatus.tools.map(tool=>{
    const entries=tool.provides.map(globalSkill).filter(entry=>entry&&skillsMatch(entry.name));
    const missing=tool.missing.length?`<p class="meta">Not on this machine: ${tool.missing.map(esc).join(', ')} ${button('Run install command',`runTool(${tool.id},false)`)}</p>`:'';
    return `<section class="kit-group"><div class="kit-group-head"><h3>${esc(tool.name)}</h3>${button('Open in Tools',"navigate('Tools')",'text')}</div>${missing}${skillsLedger(entries.map(entry=>skillsRow(entry)))}</section>`;
  }).join('');
  return `<section class="kit-section"><h2>From your tools</h2><p class="sub">These tools install and update their own skills. Your library keeps the tool and your Manual/Automatic choices.</p>${groups}</section>`;
}
function renderLibraryOnly(){
  const entries=libraryOnlySkills().filter(entry=>skillsMatch(entry.name));
  if(!entries.length)return '';
  return `<section class="kit-section"><h2>No repository source</h2><p class="sub">Saved in your library in full, so a restore brings them back.</p>${skillsLedger(entries.map(entry=>skillsRow(entry,{menu:[['Add to pack…',`addToPack('${esc(entry.name)}')`]]})))}</section>`;
}
function renderCoreTab(){
  const empty=kitStatus.sources.length||libraryOnlySkills().length?'':'<div class="empty"><h2>Core is empty</h2><p class="sub">Core is what you want on every machine, always on. Add skills from To review, or install them from a repository.</p></div>';
  const groups=kitStatus.sources.map(coreSourceGroup).join('');
  const actions=kitStatus.core.length?`<div class="inline kit-panel-actions">${button('Export JSON',"exportPack('core')",'text')}</div>`:'';
  return actions+empty+(groups?`<section class="kit-section">${groups}</section>`:'')+renderLibraryOnly()+renderToolSkills()+renderUpstream();
}

function renderPackSkills(){
  const groups=[...profiles].sort((a,b)=>byName(a.name,b.name)).map(pack=>{
    const entries=pack.skills.map(globalSkill).filter(entry=>entry&&skillsMatch(entry.name));
    return entries.length?`<details class="kit-group" ${kitDisclosureAttrs('pack:'+pack.id)}><summary>${esc(pack.name)} <span class="meta">${countOf(entries.length,'skill')} on this machine</span></summary>${skillsLedger(entries.map(entry=>skillsRow(entry,{menu:[['Drop from pack',`dropFromKit('${esc(entry.name)}','${esc(pack.id)}')`]]})))}</details>`:'';
  }).join('');
  return groups?`<section class="kit-section skills-pack-members"><h2>Pack skills on this machine</h2><p class="sub">Choose how agents invoke them, update or inspect them. The pack turns them on and off.</p>${groups}</section>`:'';
}

function machineOnlyRow(name){
  const entry=globalSkill(name),safe=esc(name);
  const core=entry&&repositorySource(entry.source)?[['Add to Core',`addToKit('${safe}','core')`]]:[];
  const menu=[...core,['Add to pack…',`addToPack('${safe}')`],['Ask again',`keepOnMachine('${safe}',false)`]];
  if(entry)return skillsRow(entry,{menu,note:entry.source?esc(sourceLabel(entry.source)):''});
  return `<div class="kit-row"><div class="kit-row-name"><code>${safe}</code><span class="meta">Not on this machine</span></div><div class="kit-actions">${button('Ask again',`keepOnMachine('${safe}',false)`,'text')}</div></div>`;
}
function renderMachineTab(){
  const names=kitStatus.machineOnly.filter(skillsMatch).sort((a,b)=>a.localeCompare(b));
  const others=otherMachineSkills().filter(entry=>skillsMatch(entry.name));
  const kept=names.length?`<section class="kit-section"><p class="sub">Kept on this machine only, outside your library and backup.</p>${skillsLedger(names.map(machineOnlyRow))}</section>`:'';
  const loose=others.length?`<section class="kit-section"><h2>Other skills here</h2><p class="sub">Installed on this machine but not sorted yet. Turn one on to review it.</p>${skillsLedger(others.map(entry=>skillsRow(entry)))}</section>`:'';
  const nested=typeof nestedSkillSection==='function'?nestedSkillSection(nestedInventories.Global||[]):'';
  const empty=kept||loose||nested?'':'<div class="empty"><h2>Nothing kept on this machine only</h2><p class="sub">Skills you keep here stay out of your library and backup. Choose This machine only for one in To review.</p></div>';
  return empty+kept+loose+nested;
}

function libraryReady(){return Boolean(backupState?.status?.library||agentFolderInfo?.library)}
function reviewActions(item){
  const name=esc(item.name);
  if(!libraryReady())return undecidedActions(item);
  const keep=button('This machine only',`keepSkillHere('${name}',${item.installable})`,'text');
  const pack=item.installable?button('Pack…',`addToPack('${name}')`):button('Link to a tool…',`linkToTool('${name}')`);
  return button('Add to library',`adoptSkillInto('${name}','library')`)+pack+keep+button('Remove',`removeFromMachine('${name}')`,'text danger');
}
function reviewRow(item){
  const entry=globalSkill(item.name);
  const description=item.description?`<span class="meta kit-row-note" title="${esc(item.description)}">${esc(item.description)}</span>`:'';
  const chip=entry?skillBackupChip(entry):'';
  return `<div class="kit-row review-row"><div class="kit-row-name is-stacked"><span class="review-title"><code>${esc(item.name)}</code>${chip}</span>${description}</div><div class="kit-actions">${reviewActions(item)}${button('Inspect',`inspectSkill('${esc(item.name)}')`,'text')}</div></div>`;
}
function renderReviewTab(){
  const items=kitStatus.undecided.filter(item=>skillsMatch(item.name));
  if(!kitStatus.undecided.length)return '<div class="kit-clear"><h2>Nothing to review</h2><p class="sub">Skills installed outside AFK appear here so you can add them to your library or keep them on this machine.</p></div>';
  const groups=undecidedGroups().map(([source,group])=>{
    const shown=group.filter(item=>items.includes(item));
    if(!shown.length)return '';
    const title=source?kitSourceHeading(source,shown.length):`<div class="kit-source"><h3>No repository source</h3><span class="meta">Another machine can’t download these, so the library keeps their files.</span></div>`;
    return `<section class="kit-group"><div class="kit-group-head">${title}</div>${shown.map(reviewRow).join('')}</section>`;
  }).join('');
  return `<section class="kit-section" data-od-id="kit-undecided"><p class="sub">Installed here outside AFK. Add each to your library to keep it and back it up, or keep it on this machine only.</p>${groups}</section>`;
}

function adoptSkillInto(name,to,bookmark=false){
  return operation(async()=>{
    await request('skill/adopt',{name,to,...(bookmark?{bookmark:true}:{})});
    toast(to==='library'?`${name} is in your library and will be backed up.`:`${name} stays on this machine only.`);
  });
}
function keepSkillHere(name,installable){
  if(!installable)return adoptSkillInto(name,'machine');
  modal('Keep '+esc(name)+' on this machine',`<p>It stays out of your library and backup.</p><label class="check"><input type="checkbox" id="keepBookmark"><span>Bookmark its repository in Try later</span></label>`,button('Cancel','closeModal()','text')+button('Keep on this machine',`closeModal();adoptSkillInto('${esc(name)}','machine',$('keepBookmark').checked)`,'primary'));
}

function skillsSearch(){
  return `<label class="search skills-search">Find a skill<span class="search-field"><input type="search" id="skillsSearch" value="${esc(skillsQuery)}" oninput="skillsQuery=this.value;renderSkillsPanel()" placeholder="Search names" autocomplete="off"><kbd aria-hidden="true">/</kbd></span></label>`;
}
function skillsPanelHtml(){
  const panels={core:renderCoreTab,packs:()=>renderPacksPanel()+renderPackSkills(),machine:renderMachineTab,later:renderSourcesPanel,review:renderReviewTab};
  return panels[skillsTab]();
}
function renderSkillsPanel(){
  const panel=$('skillsPanel');
  if(!panel)return;
  panel.innerHTML=skillsPanelHtml();
  if(skillsTab==='later')renderSourceList();
}
function renderKit(){
  if(scope!=='Global')return renderSkills();
  const pending=planCount()>0;
  const scopes=projects.length?`<label class="skills-scope">Scope<select id="scopeSelect" onchange="setScope(this.value)">${scopeOptions(scope)}</select></label>`:'';
  const update=globalSkills().length?button(skillActionLabel('Update all','update'),'showSkillUpdate()','','data-od-id="update-skills"'):'';
  const sync=button(pending?`Sync this machine · ${planCount()}`:'Nothing to sync','reviewSync()',pending?'primary':'',pending?'data-od-id="sync-machine"':'disabled data-od-id="sync-machine"');
  const actions=`<div class="inline skills-page-actions">${button('Install skills','showInstallSkills()',pending?'':'primary','data-od-id="install-skills"')}${update}${sync}</div>`;
  const searchable=skillsTab!=='later';
  $('view').innerHTML=head('Skills','Your library and this machine in one place. Core is backed up in full, packs as definitions, and machine-only skills stay here.',actions)
    +`<div class="skills-toolbar">${scopes}${searchable?skillsSearch():''}</div>`
    +skillsTabs()+`<div id="skillsPanel" role="tabpanel" aria-labelledby="skillsTab-${skillsTab}">${skillsPanelHtml()}</div>`;
  if(skillsTab==='later')renderSourceList();
}
