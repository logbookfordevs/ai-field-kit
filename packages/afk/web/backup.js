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

function backupHeadline(status){
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
  target.innerHTML=`<div class="backup-box" data-state="${status.state}"><b class="status ${headline.tone}">${headline.title}</b><span class="meta">${esc(headline.detail)}</span>${repository}<span class="inline">${action}${connected?button('Details',"navigate('Backup')",'text'):''}</span></div>`;
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
    $('view').innerHTML=head('Backup','Save your library to a private Git repository.')+`<div class="empty"><h2>No library yet</h2><p class="sub">Start a library first with <code>afk library init --apply</code>, then come back to back it up.</p>${button('Restore my library from a backup','showFirstRun()','','data-od-id="backup-restore"')}</div>`;
    return;
  }
  if(status.state==='off'){
    $('view').innerHTML=head('Backup','Save your library to a private Git repository, like a saved game.')+renderBackupSetup()+(state.contents?backupContentsRow(state.contents):'');
    return;
  }
  const save=button(status.state==='failed'?'Retry now':'Save now','saveBackupNow()','primary',`data-backup-save ${status.pushing||backupBusy?'disabled':''}`);
  $('view').innerHTML=head('Backup','AFK saves 2 minutes after each change. If saving fails, changes wait here and nothing is lost.',save)
    +`<div class="backup-grid">${renderBackupStatus(status)}${state.contents?backupContentsRow(state.contents):''}</div>`
    +'<h2>History</h2>'+backupHistoryRows(state.history||[])+'<p class="hint">Going back is itself a new save, so it can be undone too.</p>';
}

async function loadBackup(full=section==='Backup'){
  if(Date.now()-backupLoadedAt<500&&!full)return;
  backupLoadedAt=Date.now();
  try{backupState=await request('backup/state',full?{}:{brief:true})}
  catch{return}
  renderBackupBox();
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
    toast(status?.state==='failed'?'Not saved yet: '+(status.error||'the remote could not be reached')+'. Your changes are kept here.':message);
  }catch(error){toast(error.message)}
  finally{backupBusy=false;renderBackupBox();if(section==='Backup')renderBackup()}
}
saveBackupNow=()=>backupAction(()=>request('backup/save',{}),'Saved.');
createBackupRepository=()=>backupAction(()=>request('backup/create',{name:$('backupRepository').value.trim()}),'Private repository created and backed up.');
connectBackupRemote=()=>backupAction(()=>request('backup/connect',{url:$('backupUrl').value.trim()}),'Connected and backed up.');
confirmGoBack=index=>{
  const earlier=backupState.history[index+1],latest=backupState.history[index];
  modal('Go back to before this?',`<p>The library returns to how it was before <b>${esc(latest.message)}</b>.</p><p class="hint">This becomes a new save, so you can go back again if you change your mind.</p>`,button('Cancel','closeModal()','text')+button('Go back',`goBackTo('${esc(earlier.id)}')`,'primary','data-backup-confirm'));
};
goBackTo=id=>{closeModal();return backupAction(()=>request('backup/restore',{id}),'Went back. The library was restored as a new save.')};
changeBackupRemote=()=>modal('Change repository or disconnect',`<label>New remote URL<input id="backupNewUrl" placeholder="git@github.com:owner/afk-library.git" autocomplete="off" spellcheck="false"></label><p class="hint">Disconnecting keeps your library and its history on this machine.</p>`,button('Disconnect','disconnectBackup()','text danger')+button('Use this remote','replaceBackupRemote()','primary'));
replaceBackupRemote=()=>{const url=$('backupNewUrl').value.trim();closeModal();return backupAction(()=>request('backup/connect',{url}),'Connected and backed up.')};
disconnectBackup=()=>{closeModal();return backupAction(()=>request('backup/disconnect',{}),'Backup disconnected. Your library stays on this machine.')};

document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadBackup()});
