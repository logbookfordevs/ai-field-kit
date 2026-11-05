let backupState=null,backupTimer,backupLoadedAt=0,backupBusy=false;
const backupPollMs=20_000;

function backupAgo(at,now=Date.now()){
  const seconds=Math.max(0,Math.round((now-at)/1000));
  if(seconds<60)return 'just now';
  const minutes=Math.round(seconds/60);
  if(minutes<60)return minutes+' min ago';
  const hours=Math.round(minutes/60);
  if(hours<24)return hours+(hours===1?' hour ago':' hours ago');
  return new Date(at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function backupRepositoryName(remote){return String(remote||'').replace(/^https?:\/\//,'').replace(/^git@[^:]+:/,'').replace(/\.git$/,'').replace(/\/+$/,'')}
function backupCount(count,word){return count+' '+word+(count===1?'':'s')}
function backupWaiting(status){return status.waiting===1?'1 change waiting':status.waiting+' changes waiting'}

function backupAttention(){return backupState?.attention||[]}

function backupHeadline(status){
  if(status.held&&status.waiting>0)return {tone:'warn',title:'Waiting for you',detail:backupWaiting(status)+' on this machine. Saving is paused until the edits made outside AFK are resolved.'};
  if(status.state==='failed')return {tone:'warn',title:'Not saved yet',detail:backupWaiting(status)+' on this machine. Nothing is lost.'};
  if(status.state==='waiting')return {tone:'',title:'Saving soon',detail:backupWaiting(status)+'. AFK saves 2 minutes after the last change.'};
  if(status.state==='saved')return {tone:'',title:'Backed up',detail:status.lastSavedAt?'Saved '+backupAgo(status.lastSavedAt):'Everything is saved.'};
  return {tone:'off',title:'Backup is off',detail:'Your library is only on this machine.'};
}

function renderBackupBox(){
  const target=$('backupBox');
  if(!target)return;
  const status=backupState?.status;
  const hasLibrary=Boolean(status?.library);
  target.hidden=!hasLibrary;
  if(!hasLibrary){target.innerHTML='';return}
  const headline=backupHeadline(status),connected=status.state!=='off';
  const repository=connected?`<span class="meta">${esc(backupRepositoryName(status.remote))}</span>`:'';
  const retry=status.state==='failed'?'Retry now':'Save now';
  const action=connected?button(retry,'saveBackupNow()','',`data-backup-save ${status.pushing||backupBusy?'disabled':''}`):button('Set up backup',"navigate('Backup')");
  const count=backupAttention().length;
  const attention=count?`<span class="status warn" data-attention-count="${count}">${count} need${count===1?'s':''} attention</span>`:'';
  const review=count?button('Review',"navigate('Backup')",'text'):connected?button('Details',"navigate('Backup')",'text'):'';
  target.innerHTML=`<div class="backup-box" data-state="${status.state}" data-held="${Boolean(status.held)}"><b class="status ${headline.tone}">${headline.title}</b><span class="meta">${esc(headline.detail)}</span>${repository}${attention}<span class="inline">${action}${review}</span></div>`;
}

function backupContentsRow(contents){
  const size=contents.skillBytes>=1048576?(contents.skillBytes/1048576).toFixed(1)+' MB':Math.max(1,Math.round(contents.skillBytes/1024))+' KB';
  const parts=[backupCount(contents.coreSkills,'Core skill')+' ('+size+')',backupCount(contents.packs,'pack definition'),backupCount(contents.tools,'tool'),backupCount(contents.bookmarks,'Try later bookmark'),backupCount(contents.choices,'Manual/Automatic choice')];
  if(contents.rules)parts.push('AGENTS.md');
  return `<div class="backup-contents"><b>In this backup</b><span class="meta">${parts.map(esc).join(' · ')}</span><span class="meta">Not saved: machine-only skills, skills that are off, pack skill files, project folders.</span></div>`;
}

function backupHistoryRows(history){
  if(!history.length)return '<div class="empty"><h2>No saves yet</h2></div>';
  return `<div class="ledger">${history.map((entry,index)=>{
    const earlier=history[index+1];
    const goBack=earlier?button('Go back to before this',`confirmGoBack(${index})`,'text',`data-od-id="backup-go-back-${index}"`):'';
    return `<div class="row backup-save" data-save="${esc(entry.id)}" data-pushed="${entry.pushed}"><span class="meta">${esc(backupAgo(entry.at))}</span><span>${esc(entry.message)}${entry.pushed?'':' <span class="meta">· not pushed yet</span>'}</span>${goBack}</div>`;
  }).join('')}</div>`;
}

function attentionTime(at){return at?' changed '+backupAgo(at):''}

function renderAttentionItem(item,index){
  if(item.kind==='replaced'){
    const detail=item.changed?'<code>npx skills update</code> swapped the link for a plain folder with a newer version.':'Skills CLI swapped the link for a plain folder with the same files.';
    return `<div class="row attn" data-attention="${esc(item.id)}"><div><b>${esc(item.name)}</b> <span class="status warn">Replaced by Skills CLI</span><p class="meta">${detail}</p></div><span class="inline">${button('Take the update',`takeSkillsUpdate(${index})`,'primary',`data-od-id="attention-take-${index}"`)}${button('Restore saved version',`confirmRestoreSaved(${index})`,'',`data-od-id="attention-restore-${index}"`)}</span></div>`;
  }
  const files=(item.files||[]).slice(0,3).join(', ')+((item.files||[]).length>3?' and '+((item.files||[]).length-3)+' more':'');
  return `<div class="row attn" data-attention="${esc(item.id)}"><div><b>${esc(item.name)}</b> <span class="status warn">Edited outside AFK</span><p class="meta">${esc(files)}${esc(attentionTime(item.at))} outside AFK's editor. Not saved yet.</p></div><span class="inline">${button('Keep edit',`keepEdit(${index})`,'primary',`data-od-id="attention-keep-${index}"`)}${button('Discard',`confirmDiscardEdit(${index})`,'',`data-od-id="attention-discard-${index}"`)}</span></div>`;
}

function renderAttention(status){
  const items=backupAttention();
  if(!items.length)return '';
  const paused=status.held?'<p class="hint" data-held>Saving to the remote is paused until the edits made outside AFK are kept or discarded.</p>':'';
  return `<h2>Needs attention · ${items.length}</h2><div class="ledger">${items.map(renderAttentionItem).join('')}</div>${paused}`;
}

function renderBackupSetup(){
  return `<div class="backup-setup">
    <section class="backup-panel"><h2>Create a private GitHub repository</h2>
      <p class="sub">Uses the GitHub CLI and its sign-in. AFK stores no token.</p>
      <label>Repository name<input id="backupRepository" value="afk-library" autocomplete="off" spellcheck="false"></label>
      ${button('Create and back up','createBackupRepository()','primary','data-od-id="backup-create"')}
    </section>
    <section class="backup-panel"><h2>Use another Git remote</h2>
      <p class="sub">Any URL Git can push to, using Git's own credentials.</p>
      <label>Remote URL<input id="backupUrl" placeholder="git@github.com:owner/afk-library.git" autocomplete="off" spellcheck="false"></label>
      ${button('Connect and back up','connectBackupRemote()','','data-od-id="backup-connect"')}
    </section>
  </div>
  <p class="hint" data-backup-warning>Skill files are not scanned for secrets. The repository must stay private.</p>`;
}

function renderBackupStatus(status){
  const headline=backupHeadline(status);
  const error=status.state==='failed'&&status.error?`<span class="hint status warn">${esc(status.error)}</span>`:'';
  return `<div class="backup-panel" data-state="${status.state}"><b class="status ${headline.tone}">${headline.title}</b><span class="meta">${esc(headline.detail)}</span><span class="meta">${esc(backupRepositoryName(status.remote))}</span>${error}${button('Change repository or disconnect','changeBackupRemote()','text')}</div>`;
}

function renderBackup(){
  const state=backupState;
  if(!state){$('view').innerHTML=head('Backup','Loading…');return}
  const status=state.status;
  if(!status.library){
    $('view').innerHTML=head('Backup','Save your library to a private Git repository.')+`<div class="empty"><h2>No library yet</h2><p class="sub">Start a library from this machine’s skills, or bring one back from a backup.</p>${button('Start a new library','showStartLibrary()','primary','data-od-id="backup-start"')}${button('Restore my library from a backup','showFirstRun()','','data-od-id="backup-restore"')}</div>`;
    return;
  }
  if(status.state==='off'){
    $('view').innerHTML=head('Backup','Save your library to a private Git repository, like a saved game.')+renderAttention(status)+renderBackupSetup()+(state.contents?backupContentsRow(state.contents):'');
    return;
  }
  const save=button(status.state==='failed'?'Retry now':'Save now','saveBackupNow()','primary',`data-backup-save ${status.pushing||backupBusy?'disabled':''}`);
  $('view').innerHTML=head('Backup','AFK saves 2 minutes after each change. If saving fails, changes wait here and nothing is lost.',save)
    +`<div class="backup-grid">${renderBackupStatus(status)}${state.contents?backupContentsRow(state.contents):''}</div>`
    +renderAttention(status)
    +'<h2>History</h2>'+backupHistoryRows(state.history||[])+'<p class="hint">Going back is itself a new save, so it can be undone too.</p>';
}

async function loadBackup(full=section==='Backup'){
  if(Date.now()-backupLoadedAt<500&&!full)return;
  backupLoadedAt=Date.now();
  try{backupState=await request('backup/state',full?{}:{brief:true})}
  catch{return}
  renderBackupBox();
  if(typeof refreshBackupChips==='function')refreshBackupChips();
  if(section==='Backup'&&!document.activeElement?.closest?.('#view input'))renderBackup();
  scheduleBackupPoll();
}
function scheduleBackupPoll(){
  clearTimeout(backupTimer);
  if(document.hidden)return;
  backupTimer=setTimeout(()=>loadBackup(),backupPollMs);
}

async function backupAction(work,message){
  if(backupBusy)return;
  backupBusy=true;renderBackupBox();
  try{
    const status=await work();
    await loadBackup(true);
    toast(status?.state==='failed'?'Not saved yet: '+(status.error||'the remote could not be reached')+'. Your changes are kept here.':typeof message==='function'?message():message);
  }catch(error){toast(error.message)}
  finally{backupBusy=false;renderBackupBox();if(section==='Backup')renderBackup()}
}
saveBackupNow=()=>backupAction(()=>request('backup/save',{}),'Saved.');
createBackupRepository=()=>backupAction(()=>request('backup/create',{name:$('backupRepository').value.trim()}),'Private repository created and backed up.');
connectBackupRemote=()=>backupAction(()=>request('backup/connect',{url:$('backupUrl').value.trim()}),'Connected and backed up.');
const attentionItem=index=>backupAttention()[index];
keepEdit=index=>backupAction(async()=>{await request('backup/keep',{id:attentionItem(index).id})},'Edit kept and saved.');
discardEdit=index=>{closeModal();return backupAction(async()=>{await request('backup/discard',{id:attentionItem(index).id})},'The saved version is back.')};
const asideNote=moves=>moves?.length?` A different copy was kept in ${moves.map(move=>move.to).join(', ')}.`:'';
takeSkillsUpdate=index=>{let moves=[];return backupAction(async()=>{moves=(await request('backup/take-update',{name:attentionItem(index).name}))?.movedAside},()=>'The update is stored and linked.'+asideNote(moves))};
restoreSaved=index=>{closeModal();let moves=[];return backupAction(async()=>{moves=(await request('backup/restore-saved',{name:attentionItem(index).name}))?.movedAside},()=>'The saved version is linked again.'+asideNote(moves))};
confirmDiscardEdit=index=>{
  const item=attentionItem(index);
  modal('Discard this edit?',`<p>The saved version of <b>${esc(item.name)}</b> comes back and your edit is deleted.</p><p class="hint">Nothing is saved to the remote, so this cannot be undone.</p>`,button('Cancel','closeModal()','text')+button('Discard',`discardEdit(${index})`,'primary','data-attention-confirm'));
};
confirmRestoreSaved=index=>{
  const item=attentionItem(index);
  modal('Restore the saved version?',`<p>The link to the saved <b>${esc(item.name)}</b> returns and the plain folder Skills CLI wrote is deleted.</p><p class="hint">Take the update instead to keep its new files.</p>`,button('Cancel','closeModal()','text')+button('Restore saved version',`restoreSaved(${index})`,'primary','data-attention-confirm'));
};
confirmGoBack=index=>{
  const earlier=backupState.history[index+1],latest=backupState.history[index];
  modal('Go back to before this?',`<p>The library returns to how it was before <b>${esc(latest.message)}</b>.</p><p class="hint">This becomes a new save, so you can go back again if you change your mind.</p>`,button('Cancel','closeModal()','text')+button('Go back',`goBackTo('${esc(earlier.id)}')`,'primary','data-backup-confirm'));
};
goBackTo=id=>{closeModal();return backupAction(()=>request('backup/restore',{id}),'Went back. The library was restored as a new save.')};
changeBackupRemote=()=>modal('Change repository or disconnect',`<label>New remote URL<input id="backupNewUrl" placeholder="git@github.com:owner/afk-library.git" autocomplete="off" spellcheck="false"></label><p class="hint">Disconnecting keeps your library and its history on this machine.</p>`,button('Disconnect','disconnectBackup()','text danger')+button('Use this remote','replaceBackupRemote()','primary'));
replaceBackupRemote=()=>{const url=$('backupNewUrl').value.trim();closeModal();return backupAction(()=>request('backup/connect',{url}),'Connected and backed up.')};
disconnectBackup=()=>{closeModal();return backupAction(()=>request('backup/disconnect',{}),'Backup disconnected. Your library stays on this machine.')};

document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadBackup()});
