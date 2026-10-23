const runtimeRefreshMs=30_000;
let runtimeTimer,runtimePending=false,runtimeLastCheck,runtimeController;

function scheduleRuntimeStatus(){
  clearTimeout(runtimeTimer);
  if(document.hidden||runtimePending)return;
  const remaining=runtimeLastCheck===undefined?0:Math.max(0,runtimeRefreshMs-(Date.now()-runtimeLastCheck));
  runtimeTimer=setTimeout(refreshRuntimeStatus,remaining);
}

async function refreshRuntimeStatus(){
  if(document.hidden||runtimePending)return;
  const target=$('runtimeStatus');
  if(!target)return;
  runtimePending=true;runtimeLastCheck=Date.now();
  runtimeController=new AbortController();
  const timeout=setTimeout(()=>runtimeController.abort(),5000);
  try{
    const response=await fetch('/api/status',{headers:{'X-AFK-Token':window.afkToken},cache:'no-store',signal:runtimeController.signal});
    if(!response.ok)throw Error('AFK status unavailable');
    const status=await response.json();
    const validPid=Number.isInteger(status.pid)&&status.pid>0;
    const validMemory=Number.isFinite(status.rssBytes)&&status.rssBytes>0;
    if(!validPid||!validMemory)throw Error('AFK status unavailable');
    if(!document.hidden)target.innerHTML=`Running · PID ${status.pid}<br>RSS ${(status.rssBytes/1024/1024).toFixed(1)} MiB`;
  }catch{
    if(!document.hidden)target.textContent='Disconnected';
  }finally{
    clearTimeout(timeout);runtimeController=undefined;runtimePending=false;scheduleRuntimeStatus();
  }
}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearTimeout(runtimeTimer);runtimeController?.abort()}
  else scheduleRuntimeStatus();
});
window.addEventListener('pagehide',()=>{clearTimeout(runtimeTimer);runtimeController?.abort()});
window.addEventListener('pageshow',scheduleRuntimeStatus);
scheduleRuntimeStatus();
