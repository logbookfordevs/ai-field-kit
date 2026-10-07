let memberPicker;
function renderMembers(names,title,local,checked=[],descriptions={},picker=profilePicker,paths=picker.paths||{}){
  memberPicker=picker;
  const isSource=picker.kind==='source'||picker.kind==='stack'||picker.kind==='installation',target=picker.kind==='installation'?'installationDiscovery':picker.kind==='stack'?'stackDiscovery':isSource?'sourceDiscovery':'discovery';
  picker.descriptions=descriptions;
  picker.paths=local?{}:paths;picker.openFolders=new Map();
  picker.names=isSource?[...new Set([...names,...checked])]:names;
  picker.selected=new Set(checked.filter(n=>picker.names.includes(n)));picker.query='';picker.selectedOnly=false;
  picker.unavailable=new Set(isSource?checked.filter(n=>!names.includes(n)):[]);
  const hint=picker.kind==='installation'?'Choose skills for this installation. The bookmark stays unchanged.':picker.kind==='stack'?'Only this stack’s selection changes. Nothing is installed.':isSource?'Only the bookmark selection is saved. Nothing is installed.':local?'Existing skill availability stays unchanged.':'New skills are downloaded disabled; existing skills stay as they are.';
  $(target).innerHTML=`<p class="hint">${hint}</p><label>${isSource?'Find skills':'Find members'}<input id="memberSearch" type="search" placeholder="Search skills, folders and descriptions" oninput="memberPicker.query=this.value;renderMemberList()" autocomplete="off"></label><div class="members-head"><strong>${esc(title)}</strong>${button('Select shown','selectShownMembers()','text','id="selectShownMembers"')}</div><div class="member-selection"><span id="memberCount" role="status"></span>${button('Selected only','toggleSelectedMembers()','','id="selectedOnly" aria-pressed="false"')}${button('Clear selection','clearMembers()','text')}</div><div id="memberResults" class="member-results" role="group" aria-label="${isSource?'Selected source skills':'Profile members'}"></div>`;
  renderMemberList();
}
function memberDescription(name){return memberPicker.descriptions[name]||(memberPicker.kind==='source'?'':(inventories.Global||[]).find(s=>s.name===name)?.description)||''}
function visibleMembers(){
  const q=memberPicker.query.trim().toLowerCase();
  return memberPicker.names.filter(name=>{const description=memberDescription(name);return (!memberPicker.selectedOnly||memberPicker.selected.has(name))&&(name+' '+description+' '+(memberPicker.paths[name]||'')).toLowerCase().includes(q)});
}
function memberRow(name){
  const description=memberDescription(name),unavailable=memberPicker.unavailable.has(name),path=memberPicker.paths[name];
  const folder=path?.split('/').at(-1),differentFolder=folder&&folder!=='.'&&folder!==name;
  return `<label class="check member-leaf"><input class="member-check" type="checkbox" value="${esc(name)}" ${memberPicker.selected.has(name)?'checked':''} onchange="memberChanged(this)"><span><strong>${esc(name)}</strong>${differentFolder?`<small class="member-path">Folder: ${esc(folder)}</small>`:''}${description?`<small class="member-description">${esc(description)}</small>`:''}${unavailable?'<small class="field-error">Not found in the latest scan</small>':''}</span></label>`;
}
function memberTree(names){
  const root={folders:new Map(),names:[],members:[]};
  for(const name of names){
    const path=memberPicker.paths[name];
    if(!path){root.names.push(name);continue}
    const parents=path==='.'?[]:path.split('/').slice(0,-1);
    let node=root,folderPath='';
    for(const folder of parents){
      folderPath=folderPath?folderPath+'/'+folder:folder;
      if(!node.folders.has(folder))node.folders.set(folder,{name:folder,path:folderPath,folders:new Map(),names:[],members:[]});
      node=node.folders.get(folder);node.members.push(name);
    }
    node.names.push(name);
  }
  return root;
}
function memberFolderCount(node){
  const selected=node.members.filter(name=>memberPicker.selected.has(name)).length;
  return selected?`${selected}/${node.members.length} selected`:`${node.members.length} skills`;
}
function renderMemberFolder(node,depth){
  const index=memberPicker.renderedFolders.push(node)-1;
  const filtering=Boolean(memberPicker.query.trim()||memberPicker.selectedOnly);
  const opened=filtering||(memberPicker.openFolders.get(node.path)??(depth===0&&!node.names.length));
  const folders=[...node.folders.values()].sort((a,b)=>a.name.localeCompare(b.name));
  return `<details class="member-folder" data-folder-path="${esc(node.path)}" ontoggle="memberFolderToggled(${index},this)" ${opened?'open':''}><summary><svg class="member-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg><svg class="member-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg><span class="member-folder-name">${esc(node.name)}</span><span class="member-folder-count" id="memberFolderCount-${index}">${memberFolderCount(node)}</span></summary><div class="member-folder-children">${folders.map(folder=>renderMemberFolder(folder,depth+1)).join('')}${node.names.map(memberRow).join('')}</div></details>`;
}
function memberFolderToggled(index,element){
  if(!element.isConnected||memberPicker.query.trim()||memberPicker.selectedOnly)return;
  const node=memberPicker.renderedFolders[index];
  if(node&&element.dataset.folderPath===node.path)memberPicker.openFolders.set(node.path,element.open);
}
function renderMemberList(){
  const names=visibleMembers();
  const tree=memberTree(names),folders=[...tree.folders.values()].sort((a,b)=>a.name.localeCompare(b.name));
  memberPicker.renderedFolders=[];memberPicker.hasFolders=folders.length>0;
  const unknown=tree.names.filter(name=>!memberPicker.paths[name]);
  const known=tree.names.filter(name=>memberPicker.paths[name]);
  const unknownLabel=folders.length&&unknown.length?'<p class="hint member-unknown">Folder information unavailable</p>':'';
  $('memberResults').innerHTML=names.length?folders.map(folder=>renderMemberFolder(folder,0)).join('')+known.map(memberRow).join('')+unknownLabel+unknown.map(memberRow).join(''):'<p class="sub member-empty">No members match. Change the search or turn off Selected only.</p>';
  updateMemberCount();
}
function updateMemberCount(){
  const n=memberPicker.selected.size;
  if(memberPicker.kind==='installation')updateInstallationSelection();else if(memberPicker.kind==='stack')updateStackSelection();else if(memberPicker.kind==='source')updateSourceSave();else $('saveProfile').disabled=!n;
  const shown=visibleMembers().length,filtered=Boolean(memberPicker.query.trim()||memberPicker.selectedOnly);
  const visibility=memberPicker.hasFolders?(filtered?`${shown} of ${memberPicker.names.length} match`:`${memberPicker.names.length} skills`):`${shown} of ${memberPicker.names.length} shown`;
  $('memberCount').textContent=`${n} selected · ${visibility}`;
  $('selectShownMembers').textContent=memberPicker.hasFolders?(filtered?'Select matches':'Select all'):'Select shown';
  $('selectedOnly').setAttribute('aria-pressed',String(memberPicker.selectedOnly));
  memberPicker.renderedFolders.forEach((node,index)=>$('memberFolderCount-'+index).textContent=memberFolderCount(node));
}
function memberChanged(input){if(input.checked)memberPicker.selected.add(input.value);else memberPicker.selected.delete(input.value);if(memberPicker.selectedOnly)renderMemberList();else updateMemberCount()}
function selectShownMembers(){visibleMembers().forEach(n=>memberPicker.selected.add(n));renderMemberList()}
function clearMembers(){memberPicker.selected.clear();renderMemberList()}
function toggleSelectedMembers(){memberPicker.selectedOnly=!memberPicker.selectedOnly;renderMemberList()}
