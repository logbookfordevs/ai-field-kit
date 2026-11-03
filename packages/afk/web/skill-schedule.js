let skillSchedule,skillScheduleSaving=false,skillScheduleTimer;
const scheduleDays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const scheduleWhen=time=>new Date(time).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});

function scheduleResultText(result){
  if(result.cancelled)return 'Cancelled; original skills unchanged';
  if(result.code!==0)return 'Failed; original skills unchanged';
  if(!result.updated)return 'Everything was already up to date';
  return plural(result.updated,'skill')+' updated';
}

function renderScheduleResult(){
  const result=skillSchedule?.lastResult;
  if(skillSchedule?.running)return '<p class="meta" role="status">Updating Global skills now… Progress also appears under Installed Skills → Update skills.</p>';
  if(!result)return '';
  const failed=result.code!==0&&!result.cancelled;
  const details=result.output?`<details ${failed?'open':''}><summary>Last run details</summary><pre>${esc(result.output)}</pre></details>`:'';
  return `<p class="${failed?'field-error':'meta'}" role="status">Last automatic run ${esc(scheduleWhen(result.at))} · ${esc(scheduleResultText(result))}</p>${details}`;
}

function renderSkillSchedule(){
  const target=$('skillScheduleBody');
  if(!target)return;
  if(!skillSchedule){target.innerHTML='<p class="meta">Loading schedule…</p>';return}
  const {enabled,frequency,time,weekday,nextRunAt}=skillSchedule;
  const isWeekly=frequency==='weekly';
  const disabled=skillScheduleSaving?'disabled':'';
  const dayField=isWeekly?`<label>Day<select id="scheduleWeekday" ${disabled} onchange="saveSkillSchedule()">${scheduleDays.map((day,index)=>`<option value="${index}" ${index===weekday?'selected':''}>${day}</option>`).join('')}</select></label>`:'';
  const nextRun=enabled&&nextRunAt?`<p class="meta">Next run ${esc(scheduleWhen(nextRunAt))}, if AFK is running then.</p>`:'';
  target.innerHTML=`<button type="button" role="switch" class="switch" id="scheduleEnabled" aria-checked="${enabled}" ${disabled} onclick="saveSkillSchedule(!skillSchedule.enabled)"><span class="track" aria-hidden="true"></span><span>${enabled?'Updating Global skills automatically':'Automatic updates off'}</span></button>
    <div class="schedule-fields">
      <label>Repeat<select id="scheduleFrequency" ${disabled} onchange="saveSkillSchedule()"><option value="daily" ${isWeekly?'':'selected'}>Daily</option><option value="weekly" ${isWeekly?'selected':''}>Weekly</option></select></label>
      ${dayField}
      <label>Time<input id="scheduleTime" type="time" required value="${esc(time)}" ${disabled} onchange="saveSkillSchedule()"></label>
    </div>
    ${nextRun}${renderScheduleResult()}`;
}

async function loadSkillSchedule(){
  clearTimeout(skillScheduleTimer);
  try{skillSchedule=await request('skills/schedule-state',{})}catch(error){$('skillScheduleBody')&&($('skillScheduleBody').innerHTML=`<p class="field-error">${esc(error.message)}</p>`);return}
  renderSkillSchedule();
  if(skillSchedule.running&&section==='Settings')skillScheduleTimer=setTimeout(loadSkillSchedule,2000);
}

async function saveSkillSchedule(enabled=skillSchedule.enabled){
  const time=$('scheduleTime').value;
  if(!time){toast('Choose a time for automatic updates.');$('scheduleTime').focus();return}
  const choice={enabled,frequency:$('scheduleFrequency').value,time,weekday:Number($('scheduleWeekday')?.value??skillSchedule.weekday)};
  const focused=document.activeElement?.id;
  skillScheduleSaving=true;renderSkillSchedule();
  try{
    skillSchedule=await request('skills/schedule',choice);
    toast(skillSchedule.enabled?'Schedule saved. Next run '+scheduleWhen(skillSchedule.nextRunAt)+'.':'Automatic skill updates turned off.');
  }catch(error){toast(error.message)}
  finally{skillScheduleSaving=false;renderSkillSchedule();if(focused)$(focused)?.focus()}
}

function renderSkillScheduleBlock(){
  const block=document.createElement('section');
  block.className='settings-block';block.dataset.odId='skill-schedule';
  block.innerHTML='<div><h2>Automatic skill updates</h2><p class="sub">Updates Global skills on this machine with the same protected update as Installed Skills. Runs only while AFK is open; a run missed while it was closed happens shortly after AFK starts.</p></div><div class="settings-body" id="skillScheduleBody"></div>';
  document.querySelector('[data-od-id="projects-settings"]').before(block);
  renderSkillSchedule();
  loadSkillSchedule();
}
