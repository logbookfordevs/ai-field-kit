function invocationInfo(name,hint){
  if(!hint)return '';
  const id='invocation-info-'+encodeURIComponent(name);
  return `<button type="button" class="skill-invoc-info" popovertarget="${esc(id)}" aria-label="Invocation details for ${esc(name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/></svg></button><div id="${esc(id)}" class="skill-invoc-popover" popover>${esc(hint)}</div>`;
}

function positionInvocationInfo(popover){
  const trigger=popover.previousElementSibling;
  if(!trigger)return;
  const anchor=trigger.getBoundingClientRect(),panel=popover.getBoundingClientRect();
  const gutter=16,gap=8;
  const left=Math.max(gutter,Math.min(anchor.left,window.innerWidth-panel.width-gutter));
  const below=anchor.bottom+gap;
  const fitsBelow=below+panel.height<=window.innerHeight-gutter;
  const top=fitsBelow?below:Math.max(gutter,anchor.top-panel.height-gap);
  popover.style.left=left+'px';
  popover.style.top=top+'px';
}

document.addEventListener('toggle',event=>{
  if(event.newState==='open'&&event.target.classList.contains('skill-invoc-popover'))positionInvocationInfo(event.target);
},true);

function repositionInvocationInfo(){
  document.querySelectorAll('.skill-invoc-popover:popover-open').forEach(positionInvocationInfo);
}

window.addEventListener('resize',repositionInvocationInfo);
document.addEventListener('scroll',repositionInvocationInfo,true);
