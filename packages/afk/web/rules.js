let afkFolder='', rules={files:[],current:'AGENTS.md',savedAt:null,stash:null}, dests=[], lastRun='', rulesErrors=[], savedRuleSnapshot='[]', rulesLoaded=false, rulesBusy=false, rulesBaseHash;
const START='<!-- AFK:RULES:START -->',END='<!-- AFK:RULES:END -->',NS='afk-rules';
const isMac=/Mac|iPhone|iPad/.test(navigator.platform||'');
function clock(){return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`}
function file(path,text){return {path,saved:text,draft:text}}
function savedText(path){const f=rules.files.find(f=>f.path===path);return f&&f.saved!==null?f.saved:undefined}
function savedRefs(){return rules.files.filter(f=>f.path!=='AGENTS.md'&&f.saved!==null)}
function currentFile(){return rules.files.find(f=>f.path===rules.current)||rules.files[0]}
function plural(n,w,ws=w+'s'){return n+' '+(n===1?w:ws)}
function listText(a){return a.length<3?a.join(' and '):a.slice(0,-1).join(', ')+' and '+a.at(-1)}
function refKey(path){return path.slice(11)}
function escRe(x){return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
const KEY_RE=/\{\{\s*([\w][\w.\-\/]*)\s*\}\}/g;
function keyRe(k){return new RegExp('\\{\\{\\s*'+escRe(k)+'\\s*\\}\\}','g')}
function refKeys(text){return [...new Set([...text.matchAll(KEY_RE)].map(m=>m[1]))]}
function lineCount(t){return t.trim()?t.trim().split('\n').length:0}

function renderRules(){
  $('view').innerHTML=head('Agent rules','Edit and save your shared rules here. Sync previews changes to the destinations you choose.',hasRuleEdits()?button('Revert all drafts','confirmRevertRules()','text'):'')
    +`<details class="rules-folder-details"><summary>AFK folder · <code>${esc(afkFolder.replace(/\/$/,'').split('/').pop())}</code><span class="meta">Global</span></summary><div class="rules-folder-context"><code class="path">${esc(afkFolder)}</code><span class="meta">Shared by every profile and project</span>${button('Change in Settings',"navigate('Settings')",'text')}</div></details>`
    +(rules.files.some(f=>f.path==='AGENTS.md')?`<section class="workbench" data-od-id="rules-workbench" aria-label="Rule files"><nav class="files" id="fileList" aria-label="Files in the AFK folder"></nav><div class="editor" id="editor"></div></section>`:firstUse())
    +`<section class="dest-section" id="destSection" data-od-id="rule-destinations" aria-labelledby="destTitle"></section>`
    +`<aside class="note" data-od-id="rules-note"><span class="rules-workspace-label">Only between the markers</span><p><strong>AFK writes inside ${esc(START)} … ${esc(END)} and nowhere else.</strong> Text outside the markers, unrelated files and the destination file itself stay yours: no symlinks, no whole-file replacement, a backup before every change. Destinations are files on this machine; moving the AFK folder between machines is up to your Git, Drive or iCloud setup.</p></aside>`;
  if(rules.files.some(f=>f.path==='AGENTS.md')){renderFiles();renderEditor()}
  renderDests();
}
function firstUse(){
  const copyButton=(id,name)=>{
    const filename=dests.find(d=>d.id===id)?.path.split('/').pop()||'AGENTS.md';
    return button(`Copy from ${name}’s ${esc(filename)}`,`startRules('${id}')`);
  };
  return `<section class="empty rules-empty" data-od-id="rules-first-use"><h2>Write your rules once</h2>
    <p class="sub">This AFK folder has no AGENTS.md yet. Start one here and it lives beside settings.json, ready to sync to Codex, Claude or any rules file you add.</p>
    <ul class="tree-list" aria-label="AFK folder contents"><li><code>settings.json</code><span class="meta">Your configuration</span><span class="status on">Present</span></li><li><code>AGENTS.md</code><span class="meta">Canonical rules, edited here</span><span class="status">Created when you save</span></li><li><code>references/</code><span class="meta">Optional supporting Markdown</span><span class="status">Empty</span></li></ul>
    <div class="inline">${button('Start AGENTS.md',"startRules()",'primary','data-od-id="start-rules"')}${copyButton('codex','Codex')}${copyButton('claude','Claude')}</div>
    <p class="hint">Copying starts an unsaved draft from the text you wrote yourself. Nothing is written until you save, and agent files change only when you sync. You can also paste existing rules straight into the editor.</p></section>`;
}
function renderFiles(){
  const refs=rules.files.filter(f=>f.path!=='AGENTS.md');
  const btn=f=>{const i=rules.files.indexOf(f),ref=f.path!=='AGENTS.md',dirty=f.draft!==f.saved;
    return `<button type="button" class="file-btn${ref?' ref':''}" aria-current="${f.path===rules.current}" data-file="${i}" data-od-id="rule-file-${slug(f.path.replace(/[^\w]+/g,'-'))}" onclick="openFile(${i})"><span>${esc(ref?f.path.slice(11):f.path)}</span>${dirty?`<span class="edited">${f.saved===null?'new':'edited'}</span>`:''}</button>`};
  $('fileList').innerHTML=`<span class="files-label rules-workspace-label">${esc(afkFolder.split('/').pop())}/</span>${btn(rules.files.find(f=>f.path==='AGENTS.md'))}<span class="files-label rules-workspace-label">references/</span>${refs.map(btn).join('')||'<p class="hint">No supporting files yet.</p>'}${button('Add reference','addReference()','text','data-od-id="add-reference"')}`;
}
function openFile(i){rules.current=rules.files[i].path;renderFiles();renderEditor();$('fileList').querySelector(`[data-file="${i}"]`).focus()}

function renderEditor(){
  const f=currentFile();
  $('editor').innerHTML=`<div id="stash"></div><div class="editor-head" id="editorHead"></div>
    <div class="editor-field"><textarea id="ruleText" spellcheck="false" aria-label="Contents of ${esc(f.path)}" aria-describedby="editorFoot" aria-autocomplete="list" aria-controls="refMenu" data-od-id="rules-editor" oninput="editDraft(this.value);refSuggest()" onkeydown="refKeydown(event)" onkeyup="if(/^(Arrow(Left|Right)|Home|End)$/.test(event.key))refSuggest()" onclick="refSuggest()" onscroll="closeRefMenu()" onblur="setTimeout(closeRefMenu,150)">${esc(f.draft)}</textarea>
      <div class="ref-menu" id="refMenu" role="listbox" aria-label="Insert a reference" data-od-id="reference-suggestions" onmousedown="event.preventDefault()" hidden></div><span class="sr-only" id="refLive" role="status"></span></div>
    <div class="editor-foot" id="editorFoot"></div>`;
  paintEditor();
}
function paintEditor(){
  const f=currentFile(),dirty=rulesDirty(),canonical=f.path==='AGENTS.md',key=isMac?'⌘S':'Ctrl+S';
  const state=dirty.length?`<span class="status warn" role="status">Unsaved · ${plural(dirty.length,'file')}</span>`:`<span class="status on" role="status">Saved${rules.savedAt?' · '+esc(rules.savedAt):''}</span>`;
  $('editorHead').innerHTML=`<div><h2>${esc(f.path)}</h2></div>
    <div class="editor-actions">${state}${canonical?'':button('Rename',`renameReference()`,'text','data-od-id="rename-reference"')+button('Remove',`removeReference()`,'text danger','data-od-id="remove-reference"')}${button('Revert',`revertFile()`,'text',f.draft===f.saved||f.saved===null?'disabled':'')}${button(`Save${dirty.length>1?' '+dirty.length+' files':''} <kbd aria-hidden="true">${key}</kbd>`,'saveRules()','',`data-od-id="save-rules" aria-keyshortcuts="${isMac?'Meta+S':'Control+S'}" ${dirty.length?'':'disabled'}`)}</div>`;
  const links=[...f.draft.matchAll(/\]\((?:\.\/)?(references\/[^)\s]+)\)/g)].map(m=>m[1]);
  const has=p=>rules.files.some(x=>x.path===p),keys=canonical?refKeys(f.draft):[],used=new Set([...links,...keys.map(k=>'references/'+k)]);
  const missing=[...keys.filter(k=>!has('references/'+k)).map(k=>`{{${k}}}`),...[...new Set(links)].filter(p=>!has(p))];
  $('editorFoot').innerHTML=`<span class="hint">Markdown · ${plural(lineCount(f.draft),'line')} · ${canonical?plural(used.size,'reference')+' used':`Copied beside each destination · key <code>{{${esc(refKey(f.path))}}}</code>`}</span>`
    +(missing.length?`<span class="link-warn" role="status">No file in references/ for ${missing.map(esc).join(', ')} · fix before syncing</span>`:`<span class="hint">${canonical?'Type <kbd>{{</kbd> to insert a reference. Each destination gets its own path on sync':'Edits stay local until you save and sync'}</span>`);
  $('stash').innerHTML=rules.stash?`<div class="stash" role="status"><span>Your previous draft was kept aside · ${esc(rules.stash.when)}</span><span class="inline">${button('Restore previous draft','restoreStash()','text')}${button('Discard it','rules.stash=null;paintEditor()','text')}</span></div>`:'';
}
function editDraft(v){
  const f=currentFile(),was=f.draft===f.saved;f.draft=v;
  paintEditor();renderDests();if(was!==(f.draft===f.saved))renderFiles();
}
function revertFile(){const f=currentFile();f.draft=f.saved;renderFiles();renderEditor();$('ruleText').focus();toast(`${f.path} reverted to the saved version.`)}
function restoreStash(){const a=rules.files.find(f=>f.path==='AGENTS.md'),s=rules.stash;rules.stash={text:a?.draft||'',files:s.files?structuredClone(rules.files):undefined,when:clock()};if(s.files)rules.files=structuredClone(s.files);else a.draft=s.text;rules.current='AGENTS.md';render();toast('Previous draft restored. The other version is kept aside.')}

/* ---- reference keys: {{ suggestions ---- */
let refMenu={open:false,items:[],i:0,from:0,q:'',total:0};
function caretXY(t,pos){
  const cs=getComputedStyle(t),m=document.createElement('div'),s=document.createElement('span');
  m.style.cssText=`position:absolute;visibility:hidden;top:0;left:0;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${t.clientWidth}px;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};padding:${cs.padding}`;
  m.textContent=t.value.slice(0,pos);s.textContent='\u200b';m.append(s);t.parentNode.append(m);
  const xy={x:s.offsetLeft+t.clientLeft,y:s.offsetTop+t.clientTop-t.scrollTop,h:s.offsetHeight};m.remove();return xy;
}
function refSuggest(){
  const t=$('ruleText');if(!t||!$('refMenu'))return;
  const hit=currentFile().path==='AGENTS.md'&&t.selectionStart===t.selectionEnd?t.value.slice(0,t.selectionStart).match(/\{\{([\w.\-\/]*)$/):null;
  if(!hit)return closeRefMenu();
  const q=hit[1].toLowerCase(),all=rules.files.filter(f=>f.path!=='AGENTS.md').map(f=>({key:refKey(f.path),note:f.saved===null?'New · not saved yet':(f.draft.match(/^#+\s*(.+)$/m)||[,'Supporting reference'])[1]}));
  const items=all.filter(r=>r.key.toLowerCase().includes(q)).sort((a,b)=>a.key.toLowerCase().indexOf(q)-b.key.toLowerCase().indexOf(q));
  if(!items.length)items.push({add:true});
  refMenu={open:true,items,i:0,from:t.selectionStart-hit[1].length-2,q:hit[1],total:all.length};
  paintRefMenu(true);
}
function paintRefMenu(announce){
  const t=$('ruleText'),m=$('refMenu'),{items,i,q,total}=refMenu,found=items.filter(x=>!x.add).length;
  m.innerHTML=`<span class="rules-workspace-label">${found?'Insert reference':total?'No match':'No references yet'}</span>${found?'':`<p class="hint">${total?`Nothing in references/ matches “${esc(q)}”.`:'Supporting files in references/ appear here.'}</p>`}
    ${items.map((x,n)=>`<div class="ref-opt" role="option" id="refOpt${n}" aria-selected="${n===i}" onclick="pickRef(${n})">${x.add?`<span>Add ${q?`<code>${esc(newRefName(q))}</code>`:'a reference'}…</span>`:`<code>{{${esc(x.key)}}}</code><span class="meta">${esc(x.note)}</span>`}</div>`).join('')}
    <span class="ref-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> choose <kbd>Enter</kbd> insert <kbd>Esc</kbd> close</span>`;
  m.hidden=false;t.setAttribute('aria-activedescendant','refOpt'+i);
  const c=caretXY(t,refMenu.from),box=t.parentNode,below=c.y+c.h+4;
  m.style.left=Math.max(0,Math.min(c.x,box.clientWidth-m.offsetWidth))+'px';
  m.style.top=(below+m.offsetHeight>box.clientHeight&&c.y-m.offsetHeight-4>=0?c.y-m.offsetHeight-4:below)+'px';
  if(announce)$('refLive').textContent=found?`${plural(found,'reference')} available. Use arrow keys, Enter to insert.`:'No matching reference. Enter adds one.';
}
function closeRefMenu(){
  if(!refMenu.open)return;refMenu.open=false;
  const m=$('refMenu');if(m){m.hidden=true;$('ruleText').removeAttribute('aria-activedescendant');$('refLive').textContent=''}
}
function newRefName(q){return /\.md$/.test(q)?q:q.replace(/\.+$/,'')+'.md'}
function refKeydown(e){
  if(!refMenu.open)return;
  const n=refMenu.items.length;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRefMenu()}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();refMenu.i=(refMenu.i+(e.key==='ArrowDown'?1:-1)+n)%n;paintRefMenu()}
  else if((e.key==='Enter'||e.key==='Tab')&&!e.shiftKey){e.preventDefault();pickRef(refMenu.i)}
}
function pickRef(i){
  const t=$('ruleText'),{from,q}=refMenu,it=refMenu.items[i],end=t.selectionStart,closed=t.value.slice(end,end+2)==='}}'?2:0;
  const name=it.add?(q?newRefName(q):''):it.key,ins=name?`{{${name}}}`:'';
  closeRefMenu();t.focus();t.setSelectionRange(from,end+closed);
  if(!document.execCommand||!document.execCommand(ins?'insertText':'delete',false,ins)){t.setRangeText(ins,from,end+closed,'end');editDraft(t.value)}
  if(!it.add)return;
  addReference();
  if(name){$('refPath').value=name;$('refLink').checked=false}
}

/* ---- references ---- */
function refPathError(p,except){
  if(!/^[\w][\w.\-\/]*\.md$/.test(p)||p.includes('..')||p.includes('//'))return 'Use a relative Markdown path such as testing.md or frontend/forms.md.';
  if(rules.files.some(f=>f.path==='references/'+p&&f.path!==except))return 'A reference with this path already exists.';
  return '';
}
function addReference(){
  modal('Add a supporting reference',`<label>Path inside references/<span class="inline"><code class="path">references/</code><input id="refPath" placeholder="testing.md" aria-describedby="refHint refError" autocomplete="off"></span></label>
    <p class="hint" id="refHint">Subfolders are kept: frontend/forms.md is copied to ${NS}/&lt;destination&gt;/references/frontend/forms.md in each destination.</p>
    <label>Markdown · optional<textarea id="refBody" rows="6" placeholder="Paste existing Markdown, or leave empty to start with a heading"></textarea></label>
    <label class="check"><input type="checkbox" id="refLink" checked><span>Reference it in AGENTS.md<small>Appends its key to the draft, e.g. {{testing.md}}</small></span></label>
    <p class="field-error" id="refError" role="alert"></p>`,
    button('Cancel','closeModal()','text')+button('Add reference','saveReference()','primary'),'AFK folder · references/');
}
function saveReference(){
  const p=$('refPath').value.trim().replace(/^references\//,''),err=refPathError(p);
  if(err){$('refError').textContent=err;$('refPath').setAttribute('aria-invalid','true');$('refPath').focus();return}
  const title=p.split('/').pop().replace(/\.md$/,'').replace(/[-_]/g,' '),path='references/'+p;
  rules.files.push({path,saved:null,draft:$('refBody').value.trim()||`# ${title[0].toUpperCase()+title.slice(1)}\n\n`});
  if($('refLink').checked){const a=rules.files.find(f=>f.path==='AGENTS.md');a.draft=a.draft.trimEnd()+`\n- ${title[0].toUpperCase()+title.slice(1)}: {{${p}}}`}
  rules.current=path;closeModal();render();$('ruleText').focus();
  toast(`${path} added as an unsaved draft. Save to write it to the AFK folder.`);
}
function renameReference(){
  const f=currentFile(),a=rules.files.find(x=>x.path==='AGENTS.md').draft,n=a.split(`](${f.path})`).length-1+(a.match(keyRe(refKey(f.path)))||[]).length;
  modal('Rename reference',`<label>Path inside references/<span class="inline"><code class="path">references/</code><input id="refPath" value="${esc(f.path.slice(11))}" aria-describedby="refError"></span></label>
    ${n?`<label class="check"><input type="checkbox" id="refRelink" checked><span>Update ${plural(n,'mention')} in AGENTS.md<small>Changes the draft; save to keep it</small></span></label>`:'<p class="hint">AGENTS.md does not mention this file.</p>'}
    <p class="hint">On the next sync, destinations get the copy at its new path and the old AFK copy is removed.</p><p class="field-error" id="refError" role="alert"></p>`,
    button('Cancel','closeModal()','text')+button('Rename','doRename()','primary'),'AFK folder · references/');
}
function doRename(){
  const f=currentFile(),p=$('refPath').value.trim().replace(/^references\//,''),err=refPathError(p,f.path);
  if(err){$('refError').textContent=err;$('refPath').focus();return}
  const old=f.path;f.path='references/'+p;rules.current=f.path;
  if($('refRelink')?.checked){const a=rules.files.find(x=>x.path==='AGENTS.md');a.draft=a.draft.replace(keyRe(refKey(old)),`{{${p}}}`).replaceAll(`](${old})`,`](${f.path})`).replaceAll(`[${old}]`,`[${f.path}]`)}
  closeModal();render();refocus('rename-reference');toast(`Renamed to ${f.path}; save to keep this change.`);
}
function removeReference(){
  const f=currentFile();
  modal('Remove '+esc(f.path)+'?',`<p>Removes this file from your AFK folder.</p><ul class="facts"><li>Its key <code>{{${esc(refKey(f.path))}}}</code> stays in AGENTS.md, is flagged in the editor and blocks sync until it is fixed or removed.</li><li>On the next sync, AFK deletes only the copy it wrote: <code>${NS}/&lt;destination&gt;/${esc(f.path)}</code>.</li><li>Files AFK did not write are never touched.</li></ul>`,
    button('Cancel','closeModal()','text')+button('Remove file','doRemoveReference()','primary'),'AFK folder · references/');
}
function doRemoveReference(){
  const i=rules.files.indexOf(currentFile()),f=rules.files[i];
  rules.files.splice(i,1);rules.current='AGENTS.md';closeModal();render();
  toast(`${f.path} removed.`,{label:'Undo',run:()=>{rules.files.splice(i,0,f);rules.current=f.path;render()}});
}


function draftSnapshot(){return JSON.stringify(rules.files.map(f=>({path:f.path,content:f.draft})).sort((a,b)=>a.path.localeCompare(b.path)))}
function hasRuleEdits(){return draftSnapshot()!==savedRuleSnapshot}
function rulesDirty(){
  const changed=rules.files.filter(f=>f.draft!==f.saved);
  if(!changed.length&&hasRuleEdits())return [{path:'reference list'}];
  return changed;
}
function rulesState(state,force=false){
  const nextFolder=state.folder,folderChanged=afkFolder!==nextFolder;
  if(folderChanged&&rulesLoaded&&hasRuleEdits()&&!force)throw Error('Save or revert your rule drafts before changing the AFK folder.');
  const preserveDraft=rulesLoaded&&!folderChanged&&hasRuleEdits()&&!force;
  if(!preserveDraft){
    const current=rules.current;
    rules.files=state.files.filter(f=>f.path!=='AGENTS.md'||state.canonicalExists!==false).map(f=>file(f.path,f.content));
    rules.current=rules.files.some(f=>f.path===current)?current:'AGENTS.md';
    savedRuleSnapshot=draftSnapshot();rulesBaseHash=state.filesHash;
    if(folderChanged)rules.stash=null;
  }
  const selected=new Map(dests.map(d=>[d.id,d.selected]));
  dests=state.destinations.map(d=>({...d,managed:d.status!=='off',selected:selected.get(d.id)??d.status!=='off'}));
  rulesErrors=state.errors||[];afkFolder=nextFolder;rulesLoaded=true;
}
async function loadRules(force=false){rulesState(await request('rules/state'),force)}
async function rulesAction(action,success){
  if(rulesBusy)return;
  rulesBusy=true;
  try{await action();await loadRules();if(section==='Agent rules')render();if(success)toast(success)}
  catch(error){toast(error.message);rulesErrors=[...new Set([...rulesErrors,error.message])];const feedback=$('ruleActionError')||$('rulesError');if(feedback)feedback.textContent=error.message;console.error(error)}
  finally{rulesBusy=false;if(section==='Agent rules'&&$('destSection'))renderDests()}
}
async function startRules(from){
  try{
    const existing=from?await request('rules/existing',{id:from}):null;
    const text=existing?existing.text.split('\n').filter(line=>line.trim()!==START&&line.trim()!==END&&!line.trim().startsWith('<!-- Managed by AFK.')).join('\n'):'# Agent rules\n\n';
    if(!text&&from){toast('This destination contains no text to copy. Start a new document or paste your rules.');return}
    rules.files=[{path:'AGENTS.md',saved:null,draft:text},...rules.files.filter(f=>f.path!=='AGENTS.md')];rules.current='AGENTS.md';
    render();$('ruleText').focus();$('ruleText').setSelectionRange(text.length,text.length);
    toast('Unsaved draft created. Save it before syncing to agents.');
  }catch(error){toast(error.message)}
}
async function saveRules(thenSync=false){
  if(rulesBusy)return;
  if(!hasRuleEdits()){if(thenSync)await syncPreview();return}
  rulesBusy=true;
  const focus=document.activeElement,selection=focus?.id==='ruleText'?[focus.selectionStart,focus.selectionEnd]:null;
  const files=rules.files.map(f=>({path:f.path,content:f.draft}));
  const controls=[...$('view').querySelectorAll('input,textarea,button,select')].filter(el=>!el.disabled);controls.forEach(el=>el.disabled=true);
  try{
    await request('rules/save',{files,expectedHash:rulesBaseHash});await loadRules(true);rules.savedAt=clock();
    if(section==='Agent rules'){renderRules();if(selection){$('ruleText').focus();$('ruleText').setSelectionRange(...selection)}}
    if(thenSync)await syncPreview();else toast('Rules saved. Agent files change only when you sync.');
  }catch(error){toast(error.message);rulesErrors=[...new Set([...rulesErrors,error.message])];const el=$('rulesError');if(el)el.textContent=error.message;if(/chang|stale|conflict/i.test(error.message))await reviewDiskConflict(error.message)}
  finally{rulesBusy=false;controls.filter(el=>el.isConnected).forEach(el=>el.disabled=false);if(section==='Agent rules'&&$('destSection')){paintEditor();renderDests();if(selection&&!$('sheet').open){$('ruleText').focus();$('ruleText').setSelectionRange(...selection)}}}
}
function destStatus(d){return d.status}
const STATUS={current:['on','Current'],outdated:['stale','Out of date'],never:['','Never synced'],conflict:['warn','Conflict'],off:['off','Not connected']};
function syncLabel(){return hasRuleEdits()?'Save &amp; sync…':'Sync saved rules'}
function summaryText(){
  if(!rules.files.length)return 'Start AGENTS.md first, then save and sync it to your agents.';
  const selected=dests.filter(d=>d.managed&&d.selected);
  if(!selected.length)return 'Choose at least one destination to sync.';
  return `${plural(selected.length,'destination')} selected. Sync previews the saved files before making changes.${hasRuleEdits()?' Your editor contains unsaved changes.':''}`;
}
function renderDests(){
  const el=$('destSection');if(!el)return;
  const selected=dests.some(d=>d.selected&&d.managed),ready=rules.files.some(f=>f.path==='AGENTS.md');
  el.innerHTML=`<div class="dest-head"><h2 id="destTitle">Destinations</h2><span class="meta">${plural(dests.length,'file')} on this machine</span></div>
    <div class="dest-bar"><div><p class="dest-summary" id="syncSummary" aria-live="polite">${esc(summaryText())}</p><p class="meta">${esc(lastRun)}</p></div>${button(syncLabel(),'openSync()','primary',`data-od-id="sync-rules" ${selected&&ready&&!rulesBusy?'':'disabled'}`)}</div>
    <p id="rulesError" class="field-error rules-error" role="alert">${rulesErrors.map(esc).join(' ')}</p>
    <div class="ledger dests"><div class="ledger-head dest-row" aria-hidden="true"><span></span><span>Destination file</span><span>Status</span><span>Last sync</span><span></span></div>${dests.map(destRow).join('')}</div>
    <div class="dest-add">${button('Add custom destination','editDest()','','data-od-id="add-destination"')}${button('Check destinations','checkDestinations()','text')}<span class="hint">Choose a file path, such as ~/Projects/my-project/AGENTS.md.</span></div>`;
}
function dateLabel(value){return value?new Date(value).toLocaleString():'Never'}
function destRow(d){
  const [cls,label]=STATUS[d.status]||['warn','Needs attention'];
  const id=esc(d.id),custom=d.kind==='custom';
  const actions=!d.managed?button('Reconnect',`reconnect('${id}')`,'text'):
    (d.status==='conflict'?button('Review conflict',`reviewConflict('${id}')`,'',`data-od-id="destination-${id}-conflict"`):button('Preview',`previewDest('${id}')`,'text',`data-od-id="destination-${id}-preview"`))+
    (custom?button('Edit',`editDest('${id}')`,'text'):'')+button(custom?'Remove':'Disconnect',`disconnectDest('${id}')`,'text');
  return `<article class="dest-row row" data-od-id="destination-${id}">
    <label class="dest-sel"><input type="checkbox" ${d.selected&&d.managed?'checked':''} ${d.managed?'':'disabled'} onchange="selectDest('${id}',this.checked)" aria-label="Include ${esc(d.name)} in sync"></label>
    <div class="dest-name"><h3>${esc(d.name)}</h3><code class="path">${esc(d.path)}</code><span class="meta">${custom?'Custom rules file':'Global agent rules'}</span></div>
    <div class="dest-status"><span class="status ${cls}">${label}</span><span class="hint">${esc(d.reason||'')}</span></div>
    <div class="dest-last"><span class="meta">${esc(dateLabel(d.lastSync))}</span><span class="hint">${d.lastSync?'Last successful sync':'No sync yet'}</span></div>
    <div class="dest-actions">${actions}</div></article>`;
}
function selectDest(id,on){dests.find(d=>d.id===id).selected=on;renderDests()}
async function checkDestinations(){await rulesAction(async()=>{await loadRules()},'Destinations checked against their current files.')}
function openSync(){
  if(hasRuleEdits())return modal('Save before syncing?',`<p>There are unsaved changes in your rule files. Sync uses the saved files.</p><p class="sub">Save &amp; sync saves your drafts, then previews the destination changes. No agent file changes until you confirm.</p>`,button('Keep editing','closeModal()','text')+(savedText('AGENTS.md')!==undefined?button('Sync last saved version','syncPreview()'):'')+button('Save &amp; sync','saveRules(true)','primary'));
  syncPreview();
}
let rulePreview=null;
async function syncPreview(ids=dests.filter(d=>d.selected&&d.managed).map(d=>d.id)){
  try{
    const preview=await request('rules/preview',{ids});rulePreview=preview;
    const writable=preview.targets.filter(t=>!['conflict','off','current'].includes(t.status));
    ruleModal('Sync saved rules',`<p>Review the exact files AFK will change. Existing text outside its markers stays untouched.</p>${preview.errors.length?`<div class="error" role="alert">${preview.errors.map(esc).join('<br>')}</div>`:''}${preview.targets.map(previewBlock).join('')}<p id="ruleActionError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button(writable.length?`Sync ${plural(writable.length,'destination')}`:'Nothing to write','runSync()','primary',writable.length&&!preview.errors.length?'':'disabled'),'Preview · nothing written yet');
  }catch(error){toast(error.message)}
}
function ruleModal(title,body,foot='',context=''){
  modal(title,body,foot,context);$('sheet').classList.add('wide');
}
function simpleDiff(before,after){
  const a=(before||'').split('\n'),b=(after||'').split('\n');
  let first=0;while(first<a.length&&first<b.length&&a[first]===b[first])first++;
  let ai=a.length,bi=b.length;while(ai>first&&bi>first&&a[ai-1]===b[bi-1]){ai--;bi--}
  return [...a.slice(0,first).map(s=>({t:'same',s})),...a.slice(first,ai).map(s=>({t:'del',s})),...b.slice(first,bi).map(s=>({t:'add',s})),...a.slice(ai).map(s=>({t:'same',s}))];
}
function diffHtml(rows,label){
  let output=[],run=[];
  const flush=()=>{if(run.length>6)output.push(...run.slice(0,2),{t:'fold',s:`${run.length-4} unchanged lines`},...run.slice(-2));else output.push(...run);run=[]};
  rows.forEach(row=>{if(row.t==='same')run.push(row);else{flush();output.push(row)}});flush();
  return `<div class="diff" role="region" tabindex="0" aria-label="${esc(label)}">${output.map(r=>r.t==='fold'?`<div class="fold">${esc(r.s)}</div>`:`<div class="${r.t}"><span class="g" aria-hidden="true">${r.t==='add'?'+':r.t==='del'?'−':''}</span><span>${r.t==='add'?'<span class="sr">Added: </span>':r.t==='del'?'<span class="sr">Removed: </span>':''}${esc(r.s)||' '}</span></div>`).join('')}</div>`;
}
function previewBlock(t){
  const blocked=t.status==='conflict'||t.status==='off',same=t.status==='current';
  const [cls,label]=STATUS[t.status]||['warn','Needs attention'];
  return `<section class="plan"><div class="plan-head"><div><h3>${esc(t.name)}</h3><code class="path">${esc(t.path)}</code></div><span class="status ${cls}">${label}</span></div><p class="sub">${esc(t.reason)}</p>
    ${blocked?button('Review conflict',`reviewConflict('${esc(t.id)}')`):same?'<p class="hint">No write needed.</p>':`<p class="hint">An existing file is backed up before any changes.</p><details open><summary>Destination file changes</summary>${diffHtml(simpleDiff(t.before,t.after),'Changes to '+t.path)}</details>`}
    ${t.references.filter(r=>r.before!==r.after).map(r=>`<details><summary>${r.after===null?'Remove AFK copy':r.before===null?'Copy reference':'Update reference'} · ${esc(r.path)}</summary>${diffHtml(simpleDiff(r.before,r.after),'Reference changes')}</details>`).join('')}</section>`;
}
async function runSync(){
  if(rulesBusy||!rulePreview)return;
  const preview=rulePreview,ids=preview.targets.map(t=>t.id);
  rulesBusy=true;const confirm=$('sheetContent').querySelector('.dialog-foot .primary');confirm.disabled=true;confirm.textContent='Syncing…';
  try{
    const result=await request('rules/sync',{ids,preview});await loadRules();render();
    const outcome=result.preview||preview;
    const statuses=new Map(dests.map(d=>[d.id,d]));
    const targets=outcome.targets.map(t=>({...t,status:statuses.get(t.id)?.status||t.status,reason:statuses.get(t.id)?.reason||t.reason}));
    const conflicts=targets.filter(t=>t.status!=='current');
    lastRun='Last sync · '+clock();
    ruleModal(conflicts.length?'Sync finished with skips':'Sync complete',`<div class="list">${targets.map(t=>`<div class="check"><span><strong>${esc(t.name)}</strong><small>${esc(t.path)}</small></span><span class="status ${t.status==='conflict'?'warn':'on'}">${esc(t.reason||STATUS[t.status]?.[1]||'Checked')}</span></div>`).join('')}</div>${outcome.errors?.length?`<p class="field-error">${outcome.errors.map(esc).join(' ')}</p>`:''}<p class="sub">${conflicts.length?'Resolve skipped destinations and sync again.':'Selected destinations have been checked. Your other files stay untouched.'}</p>`,button('Done','closeModal()','primary'));
  }catch(error){$('ruleActionError').textContent=error.message;confirm.disabled=false;confirm.textContent='Preview again';confirm.onclick=()=>syncPreview(ids)}
  finally{rulesBusy=false;if(section==='Agent rules'&&$('destSection'))renderDests()}
}
async function previewDest(id){await syncPreview([id])}
async function reviewConflict(id){
  try{
    const preview=await request('rules/preview',{ids:[id]}),t=preview.targets[0];
    if(!t)throw Error('Destination no longer exists. Check destinations again.');
    const content=t.before||'',start=content.indexOf(START),end=content.indexOf(END),hasMarkers=start>=0||end>=0,broken=hasMarkers&&(start<0||end<start||content.split(START).length!==2||content.split(END).length!==2);
    if(broken){
      ruleModal('Repair the AFK markers',`<p>AFK cannot safely identify its region in <code>${esc(t.path)}</code>. Repair the markers in your editor, then check again. Nothing is written while the markers are broken.</p><pre>${esc(content)}</pre><p class="hint">Use exactly one matching START and END marker. AFK will not guess where its instructions stop.</p>`,button('Close','closeModal()','text')+button('Check again',`recheck('${esc(id)}')`,'primary'));
      return;
    }
    window.reviewedRuleRegion=t.currentRegion??'';window.reviewedRulePreview=preview;
    const unownedRegion=t.reason.includes('AFK region without local ownership'),editedRegion=t.reason.includes('destination rules were edited outside AFK'),editedReference=t.reason.includes('reference was changed outside AFK'),unownedReference=t.reason.includes('existing reference is not owned by AFK');
    const title=unownedRegion?'Existing AFK region needs review':editedRegion?'Destination rules changed':editedReference?'Reference copy changed':unownedReference?'Existing reference file needs review':'Destination needs attention';
    const reason=unownedRegion?'This file already has an AFK region, but this AFK folder has no record of managing it. Choose which rules to keep.':editedRegion?'The rules inside the AFK markers changed since the last sync. Choose which rules to keep.':editedReference?'A reference copy changed since the last sync. Bringing rules into the editor does not import reference copies.':unownedReference?'A reference file already exists where AFK would copy one. AFK cannot replace a file it did not create. Move or rename that file, then review again.':t.reason;
    const canAdopt=t.currentRegion!==null,canReplace=Boolean(t.region)&&!unownedReference;
    ruleModal(title,`<div class="conflict-destination"><h3>${esc(t.name)}</h3><code class="path">${esc(t.path)}</code></div><p>${esc(reason)}</p><ul class="options conflict-options"><li class="conflict-choice"><h3>Keep the destination rules</h3><p class="sub">Load the rules inside the AFK markers as an unsaved editor draft. Your current draft is kept aside. Reference copies are not imported. Save and sync when ready.</p>${button('Bring rules into editor',`adoptExternal('${esc(id)}')`,'','id="adoptRuleRegion" '+(canAdopt?'':'disabled'))}${canAdopt?'':'<p class="hint">There is no AFK region to bring into the editor.</p>'}</li><li class="conflict-choice"><h3>Use the saved AFK rules</h3><p class="sub">Replace only the AFK region and reference copies AFK owns. Text outside the markers stays untouched. Existing files are backed up before writing.</p>${button('Replace AFK region with saved rules',`overwriteRegion('${esc(id)}')`,'danger','id="replaceRuleRegion" '+(canReplace?'':'disabled'))}${canReplace?'':`<p class="hint">${unownedReference?'Resolve the reference file collision before replacing.':'Fix the saved rules or destination before replacing.'}</p>`}</li></ul><div class="conflict-feedback"><p id="ruleActionError" class="field-error" role="alert">${preview.errors.map(esc).join(' ')}</p>${button('Review again',`reviewConflict('${esc(id)}')`,'','id="conflictReviewAgain" hidden')}</div><details open><summary>Current destination → saved AFK rules</summary>${diffHtml(simpleDiff(t.before,t.after),'Changes from the current destination to saved AFK rules')}</details>${t.references.filter(r=>r.before!==r.after).map(r=>`<details><summary>Reference · ${esc(r.path)}</summary>${diffHtml(simpleDiff(r.before,r.after),'Reference conflict')}</details>`).join('')}`,button('Decide later','closeModal()','text'));
  }catch(error){toast(error.message)}
}
async function adoptExternal(id){
  const dialog=$('sheet'),header=$('sheetTitle'),body=dialog.querySelector('.dialog-body'),feedback=$('ruleActionError');
  const isCurrentReview=()=>dialog.open&&header?.isConnected&&body?.isConnected;
  try{
    const result=await request('rules/adopt',{id});
    if(!isCurrentReview()){toast('Review finished. Reopen the destination review to bring its rules into the editor.');return}
    let a=rules.files.find(f=>f.path==='AGENTS.md');
    if(!a){a={path:'AGENTS.md',saved:null,draft:''};rules.files.unshift(a)}
    if(a.draft!==a.saved)rules.stash={text:a.draft,when:clock()};
    a.draft=result.content;rules.current='AGENTS.md';closeModal();navigate('Agent rules');$('ruleText').focus();
    toast('Destination edits loaded as a draft. Review and save before syncing.');
  }catch(error){if(isCurrentReview()&&feedback?.isConnected)feedback.textContent=error.message;toast(error.message)}
}
async function overwriteRegion(id){
  if(rulesBusy)return;
  const dialog=$('sheet'),header=$('sheetTitle'),body=dialog.querySelector('.dialog-body'),feedback=$('ruleActionError');
  const isCurrentReview=()=>dialog.open&&header?.isConnected&&body?.isConnected;
  const reviewedRegion=window.reviewedRuleRegion,reviewedPreview=window.reviewedRulePreview;
  const replace=$('replaceRuleRegion'),adopt=$('adoptRuleRegion'),reviewAgain=$('conflictReviewAgain');
  if(!isCurrentReview()||!replace||!adopt)return;
  const adoptWasDisabled=adopt.disabled;
  rulesBusy=true;replace.disabled=true;adopt.disabled=true;replace.textContent='Replacing AFK region…';
  try{
    const result=await request('rules/overwrite',{id,expectedRegion:reviewedRegion,expectedPreview:reviewedPreview});
    const target=result.preview.targets.find(t=>t.id===id);
    if(!target||target.status!=='current')throw Error(target?.reason||'The destination still needs attention. Review again before replacing.');
    await loadRules();
    if(isCurrentReview()){closeModal();if(section==='Agent rules')render()}
    toast('AFK region replaced with saved rules. Existing files were backed up.');
  }catch(error){
    rulesErrors=[...new Set([...rulesErrors,error.message])];
    if(isCurrentReview()){
      if(feedback?.isConnected)feedback.textContent=error.message;
      if(reviewAgain?.isConnected){reviewAgain.hidden=false;replace.textContent='Review again before replacing';adopt.disabled=adoptWasDisabled}
    }
    toast(error.message);console.error(error);
  }finally{rulesBusy=false;if(section==='Agent rules'&&$('destSection'))renderDests()}
}
async function recheck(id){closeModal();await checkDestinations();const d=dests.find(d=>d.id===id);if(d?.status==='conflict')await reviewConflict(id)}
function editDest(id){
  const d=dests.find(d=>d.id===id),locked=Boolean(d?.lastSync);
  modal(d?'Edit destination':'Add a custom destination',`<label>Name<input id="destName" value="${esc(d?.name||'')}" maxlength="80" placeholder="My agent"></label><label>Absolute file path<input id="destPath" value="${esc(d?.path||'')}" placeholder="~/Projects/my-project/AGENTS.md" ${locked?'readonly':''}></label><p class="hint">${locked?'Disconnect this file before changing its path.':'Choose a file, not a folder. Existing text stays outside the AFK region.'}</p><p id="ruleActionError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Save destination',`saveDest('${esc(id||'')}')`,'primary'));
}
async function saveDest(id){
  const d=dests.find(d=>d.id===id),name=$('destName').value.trim(),path=$('destPath').value.trim();
  if(!name||!safeShellValue(path)||!/^([/]|~\/)/.test(path)||path.endsWith('/')){$('ruleActionError').textContent='Enter a name and an absolute file path beginning with / or ~/.';return}
  await rulesAction(async()=>{await request('rules/destination',{destination:{...(id?{id}:{}),name,path,kind:d?.kind||'custom'}});closeModal()},'Destination saved. No agent file changed.');
}
function disconnectDest(id){
  const d=dests.find(d=>d.id===id);
  modal('Disconnect '+esc(d.name)+'?',`<p>Stop managing <code>${esc(d.path)}</code>. Its file and text outside AFK's region stay in place.</p><p class="sub">Remove AFK content deletes only the managed region and reference copies AFK owns. Conflicting or broken regions require repair first.</p><p id="ruleActionError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Stop managing only',`doDisconnect('${esc(id)}',false)`)+button('Remove AFK content',`doDisconnect('${esc(id)}',true)`,'primary'));
}
async function doDisconnect(id,clean){await rulesAction(async()=>{await request('rules/disconnect',{id,clean});closeModal()},'Destination disconnected. Your file remains in place.')}
async function reconnect(id){const d=dests.find(d=>d.id===id);await rulesAction(()=>request('rules/destination',{destination:{id,name:d.name,kind:d.kind,path:d.path}}),'Destination reconnected. Preview before syncing.')}
window.addEventListener('beforeunload',event=>{if(hasRuleEdits()){event.preventDefault();event.returnValue=''}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&section==='Agent rules'&&!$('sheet').open&&rules.files.length){event.preventDefault();saveRules()}});
$('sheet').addEventListener('close',()=>{$('sheet').classList.remove('wide')});

function renderAfkSettings(){
  renderSettings();
  const block=document.querySelector('[data-od-id="settings-file"]');
  block.innerHTML=`<div><h2>AFK folder</h2><p class="sub">Settings, AGENTS.md and references live together. Choose a repository, Drive or iCloud folder if you want your provider to sync them.</p></div><div class="settings-body"><div class="path-card"><code class="path">${esc(afkFolder||settingsPath.replace(/\/settings\.json$/,''))}</code>${button('Choose folder',"browse('settings')")}</div><ul class="tree-list"><li><code>settings.json</code><span class="meta">Configuration</span><span>Saved</span></li><li><code>AGENTS.md</code><span class="meta">Shared agent rules</span><span>${savedText('AGENTS.md')===undefined?'Not created':'Saved'}</span></li><li><code>references/</code><span class="meta">Supporting Markdown</span><span>${plural(savedRefs().length,'file')}</span></li></ul><div class="bundle-row"><div class="inline">${button('Export AFK folder · ZIP','exportAfkBundle()')}${button('Import AFK folder · ZIP',"$('bundleFile').click()")}</div><p class="hint">Includes your saved rules and references. Import remaps destinations; it never syncs agent files.</p></div><details class="settings-json"><summary>Settings only · JSON</summary><p class="hint">JSON includes configuration only. Markdown files are included in the ZIP export.</p><div class="inline">${button('Export settings · JSON','exportSettings()')}${button('Import settings · JSON',"$('importFile').click()")}</div></details><input id="bundleFile" type="file" accept=".zip,application/zip" hidden onchange="importAfkBundle(this.files[0])"><input id="importFile" type="file" accept=".json,application/json" hidden onchange="importSettings(this.files[0])"></div>`;
}
function downloadBase64(base64,name){
  const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportAfkBundle(){
  try{const result=await request('bundle/export');downloadBase64(result.base64,result.name);toast('AFK folder exported. Only saved rules are included.')}
  catch(error){toast(error.message)}
}
let pendingRuleBundle=null;
async function importAfkBundle(file){
  $('bundleFile').value='';if(!file)return;
  if(hasRuleEdits()){toast('Save your rule drafts before importing another AFK folder.');return}
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const base64=btoa(binary),preview=await request('bundle/preview',{base64});pendingRuleBundle={base64,preview};
    ruleModal('Review AFK folder import',`<p>This replaces your current configuration and canonical rule files. Your agent files are unchanged until you explicitly sync.</p><p>${plural(preview.files.length,'Markdown file')} · ${plural(preview.settings.projects.length,'project')}</p>${preview.settings.projects.map((p,i)=>`<label>${esc(p.name)} · local folder<input class="bundleProject" data-index="${i}" value="${esc(p.path||'')}"></label>`).join('')}<h3>Connect destinations on this machine</h3><p class="sub">Select the files you want to manage. Unselected destinations are left unconnected.</p>${preview.destinations.map((d,i)=>`<div class="map-row"><label class="check"><input class="bundleDestination" data-index="${i}" type="checkbox"><span>${esc(d.name)}</span></label><label>Local file path<input class="bundleDestinationPath" data-index="${i}" value="${esc(d.path||'')}"></label></div>`).join('')}<p id="ruleActionError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Import AFK folder','applyAfkBundle()','primary'),'Import preview · no agent writes');
  }catch(error){toast(error.message)}
}
async function applyAfkBundle(){
  const mappings=[...document.querySelectorAll('.bundleDestination:checked')].map(el=>({id:pendingRuleBundle.preview.destinations[Number(el.dataset.index)].id,path:document.querySelector(`.bundleDestinationPath[data-index="${el.dataset.index}"]`).value.trim()}));
  const projects=[...document.querySelectorAll('.bundleProject')].map(el=>({...pendingRuleBundle.preview.settings.projects[Number(el.dataset.index)],path:el.value.trim()}));
  try{
    await request('bundle/import',{base64:pendingRuleBundle.base64,mappings,projects});await loadRules(true);closeModal();await refresh();toast('AFK folder imported. Agent files are unchanged; preview and sync when ready.');pendingRuleBundle=null;
  }catch(error){$('ruleActionError').textContent=error.message}
}
function workspaceReview(mode,target){
  if(hasRuleEdits()){toast('Save your rule drafts before changing the AFK folder.');return}
  const selects=mode==='select';
  modal(selects?'Use this AFK folder?':'Move your AFK folder?',`<p><code>${esc(target)}</code></p><p class="sub">${selects?'Load the settings, rules and references already in this folder. No agent files are synced. Disconnect managed destinations and disable profiles before switching configurations.':'Copy your current settings, rules and references here, then use this location. The original folder is retained. Existing files are never overwritten.'}</p><p id="ruleActionError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button(selects?'Load AFK folder':'Move AFK folder',`applyWorkspace('${mode}',${esc(JSON.stringify(target))})`,'primary'));
}
function newWorkspaceFolder(){
  if(hasRuleEdits()){toast('Save your rule drafts before moving your AFK folder.');return}
  modal('Create an AFK folder',`<p class="path">Inside ${esc(folder)}</p><label>Folder name<input id="workspaceName" value="afk" maxlength="80"></label><p class="hint">Copies your configuration, rules and references to this new folder. Existing folders are never overwritten.</p><p id="ruleActionError" class="field-error" role="alert"></p>`,button('Cancel','closeModal()','text')+button('Create and use folder','createWorkspaceFolder()','primary'));
}
function createWorkspaceFolder(){const name=$('workspaceName').value.trim();if(!name||/[\/\\\u0000-\u001f]/.test(name)||name==='.'||name==='..'){$('ruleActionError').textContent='Choose a simple folder name without slashes.';return}applyWorkspace('create',folder.replace(/\/$/,'')+'/'+name)}
async function applyWorkspace(mode,target){
  try{await request('workspace',{folder:target,mode});await loadRules(true);closeModal();await refresh();toast('AFK folder changed. No agent files were synced.')}
  catch(error){$('ruleActionError').textContent=error.message}
}

function confirmRevertRules(){modal('Discard unsaved rule changes?', '<p>Your saved rules stay in the AFK folder. Unsaved text, added references and reference renames will be discarded.</p>',button('Keep editing','closeModal()','text')+button('Discard drafts','revertRuleDrafts()','primary'))}
function revertRuleDrafts(){rules.files=JSON.parse(savedRuleSnapshot).map(f=>file(f.path,f.content));rules.current='AGENTS.md';rules.stash=null;closeModal();render();toast('Rule drafts reverted. Agent files unchanged.')}

async function reviewDiskConflict(reason){
  try{
    const state=await request('rules/state');window.changedRulesState=state;
    const draft=rules.files.find(f=>f.path==='AGENTS.md')?.draft||'',saved=state.files.find(f=>f.path==='AGENTS.md')?.content||'';
    ruleModal('The AFK folder changed on disk',`<p>${esc(reason)}</p><p class="sub">Your editor drafts are retained. Reload the saved files to review changes made through another editor or sync provider; your current drafts will be kept aside.</p><details open><summary>Your draft → current saved AGENTS.md</summary>${diffHtml(simpleDiff(draft,saved),'Changes from disk')}</details>`,button('Keep editing','closeModal()','text')+button('Reload saved files','reloadChangedRules()','primary'));
  }catch(error){toast(error.message)}
}
function reloadChangedRules(){const stash={text:rules.files.find(f=>f.path==='AGENTS.md')?.draft||'',files:structuredClone(rules.files),when:clock()};rulesState(window.changedRulesState,true);rules.stash=stash;closeModal();render();toast('Saved files reloaded. Your previous drafts are kept aside.')}
