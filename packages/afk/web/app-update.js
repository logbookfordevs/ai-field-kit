let appVersion,appUpdateJob,appUpdatePolling=false,appUpdateDetailsOpen=false,appVersionChecking=false;
function renderAppUpdate(){
  const target=$('appUpdateNotice');
  if(!target)return;
  const updating=Boolean(appUpdateJob?.pending);
  const available=Boolean(appVersion?.available);
  const version=appVersion?'AFK '+esc(appVersion.current):'AFK';
  const status=updating?esc(appUpdateJob.phase):appVersionChecking?'Checking for updates…':appUpdateJob?.error?'Update needs attention':appVersion?.error?'Update check unavailable':available?'Version '+esc(appVersion.latest)+' is available':appVersion?'Up to date':'Checking for updates…';
  const actions=updating?'':appVersionChecking?button('Checking…','checkAppVersion(true)','text','disabled'):available?button(skillActionLabel('Update & restart','update'),'startAppUpdate()','primary'):button('Check for updates','checkAppVersion(true)','text');
  const output=appUpdateJob?.output||appUpdateJob?.error;
  target.innerHTML=`<span><strong>${version}</strong> · ${status}</span><div class="app-update-actions">${actions}</div>${output?`<details ${appUpdateDetailsOpen?'open':''} ontoggle="appUpdateDetailsOpen=this.open"><summary>Update details</summary>${appUpdateJob.error?`<p role="alert">${esc(appUpdateJob.error)}</p><p>You can retry, or run <code>afk update</code> in your terminal.</p>`:''}<pre>${esc(appUpdateJob.output)}</pre></details>`:''}`;
}
async function checkAppVersion(force=false){
  if(appVersionChecking)return;
  appVersionChecking=true;
  renderAppUpdate();
  try{appVersion=await request('app/update-check'+(force?'?refresh=1':''))}
  catch{appVersion={current:appVersion?.current||'',available:false,error:'Could not check for updates.'}}
  finally{appVersionChecking=false;renderAppUpdate()}
  if(force)toast(appVersion.error?'Could not check for updates. Try again.':appVersion.available?'AFK '+appVersion.latest+' is available.':'AFK '+appVersion.current+' is up to date. No update found.');
  try{appUpdateJob=await request('app/update-state');renderAppUpdate();if(appUpdateJob?.pending)pollAppUpdate()}
  catch{}
}
async function startAppUpdate(){
  appUpdateJob={pending:true,phase:'Starting update…',output:''};renderAppUpdate();
  try{await request('app/update',{});pollAppUpdate()}
  catch(error){appUpdateJob={pending:false,phase:'Update failed',output:'',error:error.message};renderAppUpdate()}
}
async function pollAppUpdate(){
  if(appUpdatePolling)return;
  appUpdatePolling=true;
  const deadline=Date.now()+12*60_000;
  try{
    while(Date.now()<deadline){
      try{
        appUpdateJob=await request('app/update-state');renderAppUpdate();
        if(!appUpdateJob?.pending)return;
      }catch{
        try{
          const response=await fetch('/',{cache:'no-store',signal:AbortSignal.timeout(3000)});
          const html=await response.text();
          const token=/window\.afkToken="([a-f0-9]+)"/.exec(html)?.[1];
          if(response.ok&&token&&token!==window.afkToken){location.reload();return}
        }catch{}
        appUpdateJob={...appUpdateJob,pending:true,phase:'Reconnecting to AFK…'};renderAppUpdate();
      }
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    appUpdateJob={...appUpdateJob,pending:false,error:'Could not reconnect. Open AFK again from your terminal; review ~/.afk/app-update.json if the restart failed.'};renderAppUpdate();
  }finally{appUpdatePolling=false}
}
