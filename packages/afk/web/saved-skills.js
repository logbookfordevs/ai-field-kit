let skillsView='installed',savedSkillComparisons={},projectStatuses={},portableConfiguration,snapshotReview,restoreSelection=new Set(),savedRestore=null,restorePoll;

function savedSkillNavigation(){
  const saved=currentSettings?.savedSkills?.find(snapshot=>snapshot.scope===scope);
  if(!saved){skillsView='installed';return ''}
  return `<div class="saved-skill-tabs" aria-label="Skill views">${button('Installed on this machine',"changeSkillsView('installed')",'skill-view-tab',`aria-pressed="${skillsView==='installed'}"`)}${button('Saved skills',"changeSkillsView('saved')",'skill-view-tab',`aria-pressed="${skillsView==='saved'}"`)}</div>`;
}
function changeSkillsView(view){skillsView=view;restoreSelection.clear();renderSkills()}
function savedInvocation(skill){return skill.invocation||'Default'}
function savedSkillAction(skill){return skill.status==='missing'?'Install & apply settings':'Apply saved settings'}
function savedSkillEligible(skill){return ['missing','different'].includes(skill.status)}
function renderSavedSkills(){
  const snapshot=currentSettings.savedSkills.find(snapshot=>snapshot.scope===scope),entries=savedSkillComparisons[scope]||[];
  const eligible=new Set(entries.filter(savedSkillEligible).map(skill=>skill.name));
  restoreSelection=new Set([...restoreSelection].filter(name=>eligible.has(name)));
  $('view').insertAdjacentHTML('beforeend',`<p class="sub">Saved ${esc(new Date(snapshot.savedAt).toLocaleString())} · ${esc(scope)}. This list travels with your configuration; skill files do not.</p><div class="saved-skill-toolbar">${button('Refresh comparison','refresh()')}${button(savedRestore?.pending?'View restore progress':'Restore results','showSavedRestore()','',savedRestore?'':'hidden')}<span id="savedSelectionActions"></span></div><div class="list saved-skill-list">${entries.map((skill,index)=>`<div class="saved-skill-row"><label class="check"><input type="checkbox" data-saved-index="${index}" ${savedSkillEligible(skill)?'':'disabled'} ${restoreSelection.has(skill.name)?'checked':''}><span><strong>${esc(skill.name)}</strong><code class="path">${esc(skill.source||'Local copy · no recoverable source')}</code><span class="meta">${skill.available?'Available':'Disabled'} · ${esc(savedInvocation(skill))}</span></span></label><div><span class="status ${skill.status==='present'?'on':''}">${esc({missing:'Missing',present:'Present',different:'Settings differ',conflict:'Source needs review',local:'Local copy required','project-missing':'Project folder missing'}[skill.status])}</span><p class="hint">${esc(skill.reason)}</p></div><div>${savedSkillEligible(skill)?button(savedSkillAction(skill),`reviewSavedRestore([${esc(JSON.stringify(skill.name))}])`):skill.status==='project-missing'?button('Choose folder in Settings',"navigate('Settings')",'text'):skill.status==='conflict'?button('Inspect installed copy',`inspectSkill(${esc(JSON.stringify(skill.name))})`,'text'):''}</div></div>`).join('')||'<div class="empty"><h2>No skills in this saved list</h2><p>Install skills on this machine, then save its inventory when you want to replace this list.</p></div>'}</div>`);
  $('view').querySelectorAll('[data-saved-index]').forEach(input=>input.onchange=()=>{const name=entries[Number(input.dataset.savedIndex)].name;input.checked?restoreSelection.add(name):restoreSelection.delete(name);renderSavedSelection()});
  renderSavedSelection();
}
function renderSavedSelection(){const target=$('savedSelectionActions');if(target)target.innerHTML=restoreSelection.size?button(`Restore selected (${restoreSelection.size})`,'reviewSavedRestore([...restoreSelection])','primary'):''}
async function reviewInstalledSnapshot(){
  const snapshotScope=scope;
  try{
    snapshotReview=await request('skills/snapshot-preview',{scope:snapshotScope});
    const review=snapshotReview;
    const changes=[['Added',review.added],['Removed from saved list',review.removed],['Settings changed',review.changed]].filter(([,names])=>names.length);
    modal('Save installed skills',`<p>Save all ${review.skills.length} installed skills in ${esc(snapshotScope)}, including disabled skills. Search and filters do not limit this list.</p><p class="hint">This saves names, known sources, availability and invocation choices. It does not copy skill files or change this machine.</p>${review.expected?'<p>This replaces the saved list for this scope. Missing saved skills listed below will be removed from the list, without uninstalling any files.</p>':''}${changes.map(([label,names])=>`<section><h3>${label}</h3><ul>${names.map(name=>`<li><code>${esc(name)}</code></li>`).join('')}</ul></section>`).join('')||'<p>The saved skill choices are unchanged.</p>'}${review.skills.some(skill=>!skill.source)?'<p class="hint">Skills without a known repository source will require their original files on another machine.</p>':''}<p id="snapshotError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Save list','saveInstalledSnapshot()','primary'));
  }catch(error){toast(error.message)}
}
async function saveInstalledSnapshot(){
  return saveForm(()=>request('skills/snapshot-save',{preview:snapshotReview}),'Installed skills saved. Skill files unchanged.','snapshotError');
}
let pendingSavedRestore;
function reviewSavedRestore(names){
  const snapshot=currentSettings.savedSkills.find(snapshot=>snapshot.scope===scope);
  pendingSavedRestore={scope,names,expected:structuredClone(snapshot)};
  const entries=(savedSkillComparisons[scope]||[]).filter(skill=>names.includes(skill.name));
  modal('Restore saved skills',`<p>Apply ${entries.length} selected skills in ${esc(scope)}. Profiles stay unchanged.</p><div class="list">${entries.map(skill=>`<div class="saved-restore-review"><strong>${esc(skill.name)}</strong><span>${esc(savedSkillAction(skill))}</span><code class="path">${esc(skill.source||'Existing local copy')}</code><span class="meta">${skill.available?'Available':'Disabled'} · ${esc(savedInvocation(skill))}</span></div>`).join('')}</div><p class="hint">Source installation uses the currently available version. Completed changes remain if another item fails. Existing copies from a different source are preserved.</p><p id="savedRestoreError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Restore selected','executeSavedRestore()','primary'));
}
async function executeSavedRestore(){
  const selection=pendingSavedRestore;if(savedRestore?.pending)return;
  savedRestore={pending:true,scope:selection.scope,items:selection.names.map(name=>({name,phase:'Waiting'})),output:''};showSavedRestore();
  restorePoll=setInterval(async()=>{try{const state=await request('skills/restore-state',{});if(state?.pending&&restorePoll){savedRestore=state;renderSavedRestore()}}catch{}},700);
  try{savedRestore=await request('skills/saved-restore',selection)}
  catch(error){savedRestore={...savedRestore,pending:false,items:savedRestore.items.map(item=>item.ok===true?item:{...item,ok:false,phase:'Failed',error:error.message})}}
  finally{clearInterval(restorePoll);restorePoll=null;renderSavedRestore();await refresh().catch(error=>toast(error.message));renderSavedRestore()}
}
function showSavedRestore(){
  if(!savedRestore)return;
  modal('Saved skill restore',`<p>Scope · ${esc(savedRestore.scope)}. Closing this view leaves restore running.</p><div id="savedRestoreProgress" role="status" aria-live="polite"></div><details><summary>Installation output</summary><pre id="savedRestoreOutput"></pre></details>`,button('Close','closeModal()','text')+button('Cancel remaining','cancelSavedRestore()','','id="cancelSavedRestore"')+button('Retry failed','retrySavedRestore()','primary','id="retrySavedRestore"'));
  renderSavedRestore();
}
function renderSavedRestore(){
  const target=$('savedRestoreProgress');if(!target||!savedRestore)return;
  target.innerHTML=`<p>${savedRestore.pending?'Restoring…':savedRestore.cancelled?'Cancelled · completed changes kept':'Finished'}</p>${savedRestore.items.map(item=>`<div class="saved-restore-review"><strong>${esc(item.name)}</strong><span>${esc(item.phase)}</span>${item.error?`<p class="field-error">${esc(item.error)}</p>`:''}</div>`).join('')}`;
  $('savedRestoreOutput').textContent=savedRestore.output||'No installer output.';
  $('cancelSavedRestore').hidden=!savedRestore.pending;
  $('retrySavedRestore').hidden=savedRestore.pending||!savedRestore.items.some(item=>item.ok===false);
}
async function cancelSavedRestore(){await request('skills/restore-cancel',{})}
function retrySavedRestore(){scope=savedRestore.scope;reviewSavedRestore(savedRestore.items.filter(item=>item.ok===false).map(item=>item.name))}
let remappingProject;
function chooseProjectFolder(index){remappingProject=projects[index];browseMode='project-remap';folder=afkHome;folderModal()}
function removeProject(index){
  const project=projects[index];
  modal('Remove project definition',`<p>Remove ${esc(project.name)} from AFK, including its saved skills list and invocation preferences. The project folder and its files are unchanged.</p><p id="removeProjectError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Remove project',`confirmProjectRemoval(${esc(JSON.stringify(project.name))})`,'danger'));
}
async function confirmProjectRemoval(name){return saveForm(()=>request('project/remove',{name}),'Project definition removed. Files unchanged.','removeProjectError')}
