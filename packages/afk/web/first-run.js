let firstRun={step:'choose',path:'restore',repositories:[],listError:'',error:'',summary:null,plan:null,started:null,ticked:new Set(),ran:[],failed:[]};

function firstRunCount(count,word){return count+' '+word+(count===1?'':'s')}

function firstRunShow(title,body,foot=''){modal(title,`<div data-first-run="${firstRun.step}" aria-live="polite">${body}</div>`,foot)}

function showFirstRun(){
  firstRun={step:'choose',path:'restore',repositories:[],listError:'',error:'',summary:null,plan:null,started:null,ticked:new Set(),ran:[],failed:[]};
  renderFirstRunChoice();
}

async function maybeFirstRun(){
  const state=await request('backup/state',{brief:true}).catch(()=>null);
  if($('sheet')?.open)return;
  if(state?.status?.library===false)showFirstRun();else showWelcome();
}

function renderFirstRunChoice(){
  firstRun.step='choose';
  firstRunShow('Welcome to AFK',
    `<p class="sub">Is this a new setup, or are you bringing your skills back from a saved library?</p>
    <div class="first-run-choices">
      <button type="button" class="first-run-choice" onclick="firstRunChoose('restore')"><b>Restore my library</b><span class="meta">You wiped this machine or got a new one. Bring back your Core skills, choices, packs, tools and Try later from your last save.</span></button>
      <button type="button" class="first-run-choice" onclick="firstRunChoose('fresh')"><b>Start a new library</b><span class="meta">First time backing up. AFK saves this machine's setup into a private Git repository.</span></button>
    </div>`,
    button('Skip for now, use AFK without a backup',"firstRunSkip()",'text'));
}

async function firstRunSkip(){
  try{await request('welcome',{})}catch{toast('Could not remember your choice. This may appear again after restarting AFK.')}
  currentSettings.welcomeDismissed=true;
  showWelcome();
}

async function firstRunChoose(path){
  firstRun.path=path;firstRun.error='';
  if(path==='fresh')return firstRunLoadPlan();
  firstRun.step='pick';
  firstRunShow('Which repository is your library?','<p class="sub">Looking up your repositories…</p>',button('Cancel',"firstRunCancel()",'text'));
  try{firstRun.repositories=await request('restore/repositories',{});firstRun.listError=''}
  catch(error){firstRun.repositories=[];firstRun.listError=error.message}
  renderFirstRunPick();
}

async function firstRunLoadPlan(){
  firstRun.step='fresh';firstRun.plan=null;firstRun.error='';
  firstRunShow('Start a new library','<p class="sub">Checking this machine’s skills. Nothing changes yet.</p>',button('Back','renderFirstRunChoice()','text'));
  try{firstRun.plan=await request('library/init-preview',{})}catch(error){firstRun.error=error.message}
  renderFirstRunFresh();
}

function showStartLibrary(){
  showFirstRun();
  return firstRunChoose('fresh');
}

function firstRunNames(title,entries,note=''){
  if(!entries.length)return '';
  const names=entries.map(entry=>typeof entry==='string'?entry:entry.name);
  return `<p class="small"><b>${esc(title)} · ${names.length}</b>${note?' '+esc(note):''}<br>${esc(names.join(', '))}</p>`;
}

function renderFirstRunFresh(){
  firstRun.step='fresh';
  const {plan,error}=firstRun;
  const problem=error?`<p class="error" role="alert">${esc(error)}</p>`:'';
  if(!plan){firstRunShow('Start a new library',problem,button('Back','renderFirstRunChoice()','text'));return}
  const lists=[
    firstRunNames('Core skills',plan.skills,'move into the library and are saved in your backup.'),
    firstRunNames('Pack skills',plan.packSkills,'are kept by AFK; their packs are saved, not their files.'),
    firstRunNames('This machine only',[...plan.machineSkills,...plan.offToolSkills],'are kept by AFK on this machine and not saved.'),
    firstRunNames('Provided by tools',plan.toolSkills,'stay where their tools put them.'),
    firstRunNames('Missing from this machine',plan.missing,'are in Core but not installed here, so they are skipped.'),
    firstRunNames('Agent rules',plan.rules,'are copied into the library.'),
  ].join('');
  firstRunShow('Start a new library',
    `<p>AFK moves this machine’s skills into a library at <code>${esc(plan.library)}</code> and links them back where your agents look for them.</p>${lists||'<p class="small">No skills to move yet. The library starts empty.</p>'}
    <p class="hint">The original folders are kept in <code>${esc(plan.backup)}</code> until you delete them.</p>${problem}`,
    button('Back','renderFirstRunChoice()','text')+button('Start the library','firstRunStartLibrary()','primary'));
}

async function firstRunStartLibrary(){
  const plan=firstRun.plan;
  if(!plan)return;
  firstRun.step='starting';firstRun.error='';
  firstRunShow('Starting your library','<p class="sub">Moving skills into the library and linking them back…</p>');
  try{firstRun.started=await request('library/init',{expected:plan})}
  catch(error){firstRun.error=error.message;renderFirstRunFresh();return}
  try{await request('welcome',{})}catch{}
  currentSettings.welcomeDismissed=true;
  await refresh().catch(()=>{});
  renderFirstRunStarted();
}

function renderFirstRunStarted(){
  firstRun.step='started';
  const {started}=firstRun;
  firstRunShow('Your library is ready',
    `<p>${esc(firstRunCount(started.skills.length,'Core skill'))} now live in your library, and every AFK change is saved there.</p>
    <p class="small">Your original folders are in <code>${esc(started.backup)}</code>. Delete them with <code>afk library confirm</code> once everything works.</p>
    <p class="hint">Next, open Backup to create a private GitHub repository or connect any Git remote. Skill files are not scanned for secrets, so the repository must stay private.</p>`,
    button('Open Skills',"firstRunGo('Skills')",'text')+button('Open Backup',"firstRunGo('Backup')",'primary'));
}

function renderFirstRunPick(){
  firstRun.step='pick';
  const rows=firstRun.repositories.map((repository,index)=>`<div class="check first-run-repository"><span><strong>${esc(repository.name)}</strong><small>${repository.private?'private':'public'}${repository.pushedAt?' · last pushed '+esc(String(repository.pushedAt).slice(0,10)):''}</small></span>${button('Restore',`firstRunRestore(${index})`,'primary')}</div>`).join('');
  const list=firstRun.repositories.length?`<div class="list">${rows}</div>`:`<p class="hint">${esc(firstRun.listError||'No repositories found for this GitHub sign-in.')} Paste a repository address instead.</p>`;
  const error=firstRun.error?`<p class="error" role="alert">${esc(firstRun.error)}</p>`:'';
  firstRunShow('Which repository is your library?',
    `${error}${list}
    <label class="first-run-url">Or paste a repository<input id="firstRunUrl" placeholder="owner/repo or git@github.com:owner/afk-library.git" autocomplete="off" spellcheck="false"></label>
    <p class="hint">Listed with your GitHub CLI sign-in. AFK checks the repository is an AFK library before downloading it, and stores no token.</p>
    <p class="hint">From a terminal: <code>afk library connect owner/repo</code></p>`,
    button('Back','renderFirstRunChoice()','text')+button('Restore from this address','firstRunRestoreUrl()'));
}

function firstRunRestore(index){
  const repository=firstRun.repositories[index];
  if(!repository)return;
  return firstRunStart(repository.url,repository.name);
}

function firstRunRestoreUrl(){
  const address=($('firstRunUrl')?.value||'').trim();
  if(!address){firstRun.error='Paste a repository address first.';renderFirstRunPick();return}
  return firstRunStart(address,address);
}

async function firstRunStart(repository,label){
  firstRun.step='restoring';firstRun.error='';
  firstRunShow('Restoring '+esc(label),'<p class="sub">Checking the repository, downloading it and linking your skills. Nothing is changed until the download is complete.</p>',button('Cancel',"firstRunCancel()",'text'));
  try{firstRun.summary=await request('restore/start',{repository})}
  catch(error){firstRun.error=error.message;renderFirstRunPick();return}
  try{await request('welcome',{})}catch{}
  currentSettings.welcomeDismissed=true;
  await refresh().catch(()=>{});
  if(firstRun.summary.tools.length)renderFirstRunTools();else renderFirstRunDone();
}

async function firstRunCancel(){
  try{await request('restore/cancel',{})}catch{}
  if(firstRun.step==='restoring'||firstRun.step==='pick')renderFirstRunChoice();
}

function renderFirstRunTools(){
  firstRun.step='tools';
  const rows=firstRun.summary.tools.map(tool=>`<label class="check"><input type="checkbox" onchange="firstRunTick(${tool.id},this.checked)"${firstRun.ticked.has(tool.id)?' checked':''}><span><strong>${esc(tool.name)}</strong>${tool.provides?.length?' · provides '+esc(tool.provides.join(', ')):''}<small>${esc(tool.install)}</small></span></label>`).join('');
  firstRunShow('Run your tools?',
    `<p class="sub">These tools install their own skills. AFK runs only the ones you tick, then applies your saved Manual/Automatic choices to what they install.</p><div class="list">${rows}</div>`,
    button('Skip, I’ll run them from Tools','firstRunRunTools(true)','text')+`<button type="button" id="firstRunRun" class="primary" onclick="firstRunRunTools()" disabled>Run tools</button>`);
}

function firstRunTick(id,checked){
  if(checked)firstRun.ticked.add(id);else firstRun.ticked.delete(id);
  const run=$('firstRunRun'),count=firstRun.ticked.size;
  if(run){run.textContent=count?'Run '+firstRunCount(count,'tool'):'Run tools';run.disabled=count===0}
}

async function firstRunRunTools(skip=false){
  const chosen=skip?[]:firstRun.summary.tools.filter(tool=>firstRun.ticked.has(tool.id));
  firstRun.ran=[];firstRun.failed=[];
  for(const tool of chosen){
    firstRunShow('Running '+esc(tool.name),`<p class="sub">Running ${esc(tool.name)} (${firstRun.ran.length+firstRun.failed.length+1} of ${chosen.length})…</p>`);
    try{
      const result=await request('tool/run',{id:tool.id});
      if(result.code===0)firstRun.ran.push(tool.name);else firstRun.failed.push(tool.name);
    }catch{firstRun.failed.push(tool.name)}
  }
  await refresh().catch(()=>{});
  renderFirstRunDone();
}

function firstRunGo(target){
  closeModal();
  navigate(target);
}

function renderFirstRunDone(){
  firstRun.step='done';
  const {summary,ran,failed}=firstRun;
  const lines=[`${firstRunCount(summary.linked.length,'Core skill')} on`,firstRunCount(summary.choices,'choice')+' applied'];
  if(ran.length)lines.push(firstRunCount(ran.length,'tool')+' ran');
  const adopted=summary.adopted.length?`<p class="small">Already here with identical files, now managed by the library: ${esc(summary.adopted.join(', '))}</p>`:'';
  const aside=summary.movedAside.length?`<div class="first-run-aside"><b>Your copy was different</b><p class="small">The library copy is used. Yours moved here, so nothing is lost:</p>${summary.movedAside.map(move=>`<p class="small"><strong>${esc(move.name)}</strong><br><code>${esc(move.to)}</code></p>`).join('')}</div>`:'';
  const problems=failed.length?`<p class="error" role="alert">${esc(failed.map(name=>name+' could not run').join(', '))}. Run it from Tools to see why.</p>`:'';
  const packs=summary.packs.length?'<p class="small">Packs are off. Turning one on downloads its skills.</p>':'';
  firstRunShow('This machine matches your library',
    `<p>${esc(lines.join(' · '))}</p>${adopted}${aside}${problems}${packs}<p class="hint">Backup is on: AFK saves 2 minutes after each change.</p>`,
    button('See backup',"firstRunGo('Backup')",'text')+button('Open Skills',"firstRunGo('Skills')",'primary'));
}
