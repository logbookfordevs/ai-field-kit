let skillEditor=null,skillEditorPane='edit',skillEditorBusy=false;

function editorInline(text){
  return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');
}
function editorMarkdown(text){
  const body=text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
  const out=[],list=[];
  let code=null,paragraph=[];
  const flushParagraph=()=>{if(paragraph.length)out.push(`<p>${editorInline(paragraph.join(' '))}</p>`);paragraph=[]};
  const flushList=()=>{if(list.length)out.push(`<ul>${list.splice(0).map(item=>`<li>${editorInline(item)}</li>`).join('')}</ul>`)};
  for(const line of body.split(/\r?\n/)){
    if(/^```/.test(line)){
      if(code===null){flushParagraph();flushList();code=[]}else{out.push(`<pre>${esc(code.join('\n'))}</pre>`);code=null}
      continue;
    }
    if(code!==null){code.push(line);continue}
    const heading=/^(#{1,3})\s+(.*)$/.exec(line),item=/^\s*[-*]\s+(.*)$/.exec(line);
    if(heading){flushParagraph();flushList();out.push(`<h3>${editorInline(heading[2])}</h3>`)}
    else if(item){flushParagraph();list.push(item[1])}
    else if(!line.trim()){flushParagraph();flushList()}
    else{flushList();paragraph.push(line.trim())}
  }
  if(code!==null)out.push(`<pre>${esc(code.join('\n'))}</pre>`);
  flushParagraph();flushList();
  return out.join('')||'<p class="meta">Nothing to preview yet.</p>';
}

function editorDirty(){return Boolean(skillEditor)&&$('editorText').value!==skillEditor.saved}
function editorReadOnly(){return Boolean(skillEditor.view.readOnly)}
function editorIsMarkdown(){return /\.md$/i.test(skillEditor.view.file)}

function editorUpdatesNote(view){
  const from=view.source?` from <code>${esc(view.source)}</code>`:'';
  if(view.updates==='ask')return `This skill updates${from}. Saving asks whether to keep your version or let updates replace your edits.`;
  if(view.updates==='replace')return `This skill updates${from}. Updates will replace your edits.`;
  if(view.updates==='stopped')return `You kept your own version. Updates${from} are stopped for this skill.`;
  return '';
}
function editorInvocationNote(view){
  const choice=view.invocation||'the skill’s default';
  return `Invocation: <strong>${esc(choice)}</strong>. This line is managed by your Manual/Automatic choice, not by this file; saving reapplies it.`;
}

function editorFilesHtml(view){
  return view.files.map(path=>`<button type="button" class="file-btn" data-editor-file="${esc(path)}" ${path===view.file?'aria-current="true"':''} onclick="openEditorFile(this.dataset.editorFile)"><span>${esc(path)}</span></button>`).join('');
}
function editorPaneToggle(){
  if(!editorIsMarkdown())return '';
  return `<div class="editor-panes" role="group" aria-label="Editor view"><button type="button" data-editor-pane="edit" aria-pressed="${skillEditorPane==='edit'}" onclick="setEditorPane('edit')">${editorReadOnly()?'Source':'Edit'}</button><button type="button" data-editor-pane="preview" aria-pressed="${skillEditorPane==='preview'}" onclick="setEditorPane('preview')">Preview</button></div>`;
}
function editorBodyHtml(){
  const {view}=skillEditor,readOnly=editorReadOnly();
  const updates=editorUpdatesNote(view);
  return `<div class="skill-editor" data-pane="${editorIsMarkdown()?skillEditorPane:'edit'}">
    <p class="path">${esc(view.path)}</p>
    ${readOnly?`<p class="editor-note" role="note"><strong>Read-only.</strong> ${esc(view.readOnly)}</p>`:''}
    ${updates&&!readOnly?`<p class="editor-note" id="editorUpdates" role="note">${updates}</p>`:'<p class="editor-note" id="editorUpdates" role="note" hidden></p>'}
    <div class="workbench">
      <div class="files" aria-label="Files">${editorFilesHtml(view)}</div>
      <div class="editor">
        <div class="editor-head"><h2>${esc(view.file)}</h2><div class="editor-actions"><span class="status" id="editorStatus" role="status">${readOnly?'Read-only':'Saved'}</span>${editorPaneToggle()}</div></div>
        <p id="editorError" class="field-error" role="alert"></p>
        <p class="meta" id="editorInvocation">${editorInvocationNote(view)}</p>
        <textarea id="editorText" class="editor-text" aria-label="${esc(view.file)} source" spellcheck="false" ${readOnly?'readonly':''} oninput="editorInput()">${esc(skillEditor.saved)}</textarea>
        <div id="editorPreview" class="editor-preview" aria-label="Preview">${editorIsMarkdown()?editorMarkdown(skillEditor.saved):''}</div>
        <div id="editorAsk" class="editor-ask" role="group" aria-label="Updates" hidden></div>
        <p class="meta">Save makes one commit, “Edit ${esc(view.name)}”, and it is backed up with the next push.</p>
      </div>
    </div>
  </div>`;
}
function editorFootHtml(){
  if(editorReadOnly())return button('Close','closeModal()','primary');
  return button('Close','closeModal()','text')+button('Revert','revertSkillEditor()','text','id="editorRevert" disabled')+button('Save','saveSkillEditor()','primary','id="editorSave" disabled');
}

function renderSkillEditor(){
  const {view}=skillEditor;
  modal(`${editorReadOnly()?'':'Edit '}${esc(view.name)}`,editorBodyHtml(),editorFootHtml());
  $('sheet').classList.add('wide');
  sheetGuard=editorCanClose;
  $('editorText')?.focus();
}

async function editSkill(name,file='SKILL.md'){
  try{
    const view=await request('skill/editor',{name,file});
    skillEditor={view,saved:view.content??''};
    skillEditorPane='edit';
    renderSkillEditor();
  }catch(error){toast(error.message)}
}

function editorSync(){
  if(!skillEditor)return;
  const dirty=editorDirty();
  $('editorStatus').textContent=dirty?'Unsaved changes':'Saved';
  const save=$('editorSave'),revert=$('editorRevert');
  if(save)save.disabled=!dirty||skillEditorBusy;
  if(revert)revert.disabled=!dirty||skillEditorBusy;
  if(editorIsMarkdown())$('editorPreview').innerHTML=editorMarkdown($('editorText').value);
}
function editorInput(){
  if(!skillEditor)return;
  $('editorError').textContent='';
  $('editorAsk').hidden=true;
  editorSync();
}
function revertSkillEditor(){
  if(!skillEditor)return;
  $('editorText').value=skillEditor.saved;
  editorInput();
}
function setEditorPane(pane){
  skillEditorPane=pane;
  const root=document.querySelector('.skill-editor');
  if(root)root.dataset.pane=pane;
  document.querySelectorAll('[data-editor-pane]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.editorPane===pane)));
}

function editorCanClose(){
  if(!editorDirty())return true;
  $('editorError').textContent='You have unsaved changes. Save them, or revert to discard them.';
  return false;
}
async function openEditorFile(file){
  if(!skillEditor||file===skillEditor.view.file)return;
  if(editorDirty()){$('editorError').textContent='Save or revert your changes before opening another file.';return}
  await editSkill(skillEditor.view.name,file);
}

function askEditorUpdates(){
  const {view}=skillEditor;
  const from=view.source?`<code>${esc(view.source)}</code>`:'its repository';
  $('editorAsk').innerHTML=`<p><strong>This skill updates from ${from}.</strong> Updates would overwrite what you just changed.</p><div class="inline">${button('Keep my version',"commitSkillEditor('keep')")}${button('Let updates replace my edits',"commitSkillEditor('replace')")}${button('Cancel',"$('editorAsk').hidden=true",'text')}</div><p class="meta">Keeping your version stops this skill’s updates.</p>`;
  $('editorAsk').hidden=false;
  $('editorAsk').querySelector?.('button')?.focus();
}
function saveSkillEditor(){
  if(!skillEditor||editorReadOnly()||!editorDirty()||skillEditorBusy)return;
  if(skillEditor.view.updates==='ask')return askEditorUpdates();
  return commitSkillEditor();
}
async function commitSkillEditor(updates){
  if(!skillEditor||skillEditorBusy)return;
  const {view}=skillEditor,content=$('editorText').value;
  skillEditorBusy=true;
  $('editorError').textContent='';
  $('editorAsk').hidden=true;
  const save=$('editorSave');
  if(save)save.disabled=true;
  try{
    await request('skill/edit',{name:view.name,file:view.file,content,...(updates?{updates}:{})});
    const next=await request('skill/editor',{name:view.name,file:view.file}).catch(()=>({...view,updates:updates==='keep'?'stopped':updates==='replace'?'replace':view.updates}));
    skillEditor={view:{...next,files:view.files},saved:content};
    const note=editorUpdatesNote(skillEditor.view);
    $('editorUpdates').innerHTML=note;
    $('editorUpdates').hidden=!note;
    toast(`Saved ${view.name} as one change.`);
    refresh().catch(()=>{});
  }catch(error){
    $('editorError').textContent=error.message;
  }finally{
    skillEditorBusy=false;
    editorSync();
  }
}
