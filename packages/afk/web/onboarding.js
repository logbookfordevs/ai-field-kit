let welcomeActive=false,welcomeDismissedHere=false,tourStep=-1;
let tourDimmerFrame;
const tourSteps=[
  {section:'Skills',copy:'Every skill in one place. Core travels with you and is backed up, packs turn on when you need them, and To review lists skills installed outside AFK. Switch each on or off and choose how agents invoke it.'},
  {section:'Agent rules',copy:'Write shared instructions for your agents here. Preview and sync them to the agents or files you choose.'},
  {section:'Tools',copy:'Keep installation and update commands for your tools in one place. Run a command when you choose to install or update a tool.'},
  {section:'Settings',copy:'See where your library lives, add the projects you work in, and choose which agent folders get your skills. Project skills stay in each project’s repository.'},
];

function startTour(){
  rememberWelcome();closeModal();tourStep=0;showTourStep();
}
function showTourStep(){
  navigate(tourSteps[tourStep].section);
  $('tourHeading')?.focus();
}
function moveTour(direction){
  const next=tourStep+direction;
  if(next<0||next>=tourSteps.length)return;
  tourStep=next;showTourStep();
}
function endTour(completed=false){
  tourStep=-1;renderTour();
  $('main').focus();
  if(completed)toast('You’re ready. Reopen the quick tour anytime from About AFK.');
}
function renderTour(){
  const target=$('featureTour');
  if(!target)return;
  const active=tourStep>=0;
  target.hidden=!active;
  if(!active){target.innerHTML='';renderTourDimmer();return}
  const step=tourSteps[tourStep],last=tourStep===tourSteps.length-1;
  target.innerHTML=`<div class="tour-copy"><p class="meta">Quick tour · ${tourStep+1} of ${tourSteps.length}</p><h2 id="tourHeading" tabindex="-1">${esc(step.section)}</h2><p>${esc(step.copy)}</p></div><div class="tour-controls">${button('Skip tour','endTour()','text')}${button('Back','moveTour(-1)','',tourStep===0?'disabled':'')}${button(last?'Finish tour':'Next',last?'endTour(true)':'moveTour(1)','primary')}</div>`;
  renderTourDimmer();
}

function renderTourDimmer(){
  const dimmer=$('tourDimmer');
  if(!dimmer)return;
  dimmer.hidden=tourStep<0;
  if(dimmer.hidden){dimmer.innerHTML='';return}
  const regions=[$('featureTour'),$('view'),document.querySelector('#nav [aria-current="page"]'),$('mobileSection')];
  const holes=regions.filter(Boolean).map(element=>{
    const rect=element.getBoundingClientRect();
    if(!rect.width||!rect.height)return '';
    return `<rect x="${rect.x-4}" y="${rect.y-4}" width="${rect.width+8}" height="${rect.height+8}" rx="8" fill="black"/>`;
  }).join('');
  dimmer.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><mask id="tourSpotlight" maskUnits="userSpaceOnUse" x="0" y="0" width="${innerWidth}" height="${innerHeight}"><rect width="100%" height="100%" fill="white"/>${holes}</mask></defs><rect width="100%" height="100%" fill="#17201e" fill-opacity="0.4" mask="url(#tourSpotlight)"/></svg>`;
}
function scheduleTourDimmer(){
  if(tourStep<0||tourDimmerFrame)return;
  tourDimmerFrame=requestAnimationFrame(()=>{tourDimmerFrame=undefined;renderTourDimmer()});
}
window.addEventListener('resize',scheduleTourDimmer);
window.addEventListener('scroll',scheduleTourDimmer,{passive:true});
new ResizeObserver(scheduleTourDimmer).observe($('view'));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&tourStep>=0&&!$('sheet').open){event.preventDefault();endTour()}
});

function maybeWelcome(){
  if(!currentSettings.welcomeDismissed&&!welcomeDismissedHere&&!$('sheet').open)void maybeFirstRun();
}

function showWelcome(){
  closeUtilities();
  modal('Welcome to AFK 2.0',
    `<p class="welcome-intro">Keep your skills ready. Bring them into your work when you need them.</p>
    <section class="welcome-section"><h3>Build your kit from what you already use</h3><p>AFK lists the skills on this machine and asks which belong in your library. Back the library up to a private Git repository, and restore it on a new machine.</p>
      <dl class="welcome-actions"><div><dt>Core</dt><dd>Skills you want on every machine, always on.</dd></div><div><dt>Packs</dt><dd>Groups you turn on for a project or Global when you need them, or read once with your agent.</dd></div></dl></section>
    <section class="welcome-section"><h3>Write your agent rules once</h3><p>Edit and save AGENTS.md here, then preview and sync it to Codex, Claude, or a custom file. AFK preserves text outside its marked region and backs up existing files.</p></section>
    <details class="welcome-extra"><summary>Skills, tools, and your library</summary><ul>
      <li><strong>Skills:</strong> inspect instructions, switch skills on or off, and choose manual or automatic invocation.</li>
      <li><strong>Tools:</strong> save global install and update commands, and the skills a tool brings with it. Running one is an explicit action.</li>
      <li><strong>Backup:</strong> every change is saved in your library, and AFK pushes it to your repository a couple of minutes later.</li>
      <li><strong>Settings:</strong> add projects, choose which agent folders get your skills, and schedule updates.</li>
    </ul></details>`,
    button('I’ll explore','closeModal()','text')+button('Take a quick tour','startTour()','primary'));
  welcomeActive=true;$('sheet').classList.add('welcome');
  $('sheetTitle').tabIndex=-1;$('sheetTitle').focus();
}

function rememberWelcome(){
  if(!welcomeActive)return;
  welcomeActive=false;welcomeDismissedHere=true;$('sheet').classList.remove('welcome');
  currentSettings.welcomeDismissed=true;
  request('welcome',{}).catch(()=>toast('Could not remember your Welcome choice. It may appear again after restarting AFK.'));
}

$('sheet').addEventListener('cancel',rememberWelcome);
$('sheet').addEventListener('close',()=>{
  if(!welcomeActive)return;
  rememberWelcome();
  (matchMedia('(max-width:760px)').matches?$('mobileSection'):document.querySelector('#nav [aria-current]'))?.focus();
});
