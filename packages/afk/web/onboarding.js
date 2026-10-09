let welcomeActive=false,welcomeDismissedHere=false,tourStep=-1;
const tourSteps=[
  {section:'Installed Skills',copy:'See the skills installed on this machine, switch their availability, and choose how agents invoke them. Save installed skills to keep a portable list you can restore elsewhere; the files stay on this machine.'},
  {section:'Profiles',copy:'Group skills for a particular kind of work. Enable a profile globally or for a project, or use Read group once to read its instructions without changing activation.'},
  {section:'Sources & Stacks',copy:'Bookmark skill repositories in Sources, and collect selected skills from multiple sources in Stacks. Choose what to install when you need it.'},
  {section:'Agent rules',copy:'Write shared instructions for your agents here. Preview and sync them to the agents or files you choose.'},
  {section:'Tools',copy:'Keep installation and update commands for your tools in one place. Run a command when you choose to install or update a tool.'},
  {section:'Settings',copy:'Choose where your AFK folder lives and add the project folders you work in. Your configuration can travel between machines; project files stay where they are.'},
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
  if(!active){target.innerHTML='';return}
  const step=tourSteps[tourStep],last=tourStep===tourSteps.length-1;
  target.innerHTML=`<div class="tour-copy"><p class="meta">Quick tour · ${tourStep+1} of ${tourSteps.length}</p><h2 id="tourHeading" tabindex="-1">${esc(step.section)}</h2><p>${esc(step.copy)}</p></div><div class="tour-controls">${button('Skip tour','endTour()','text')}${button('Back','moveTour(-1)','',tourStep===0?'disabled':'')}${button(last?'Finish tour':'Next',last?'endTour(true)':'moveTour(1)','primary')}</div>`;
}

function maybeWelcome(){
  if(!currentSettings.welcomeDismissed&&!welcomeDismissedHere&&!$('sheet').open)showWelcome();
}

function showWelcome(){
  closeUtilities();
  modal('Welcome to AFK 2.0',
    `<p class="welcome-intro">Keep your skills ready. Bring them into your work when you need them.</p>
    <p class="hint">Want to keep your configuration somewhere else? ${button('Choose AFK folder in Settings',"welcomeGo('Settings')",'text')}</p>
    <section class="welcome-section"><h3>Start with a skill group</h3><p>A profile groups skills from a repository or this machine. New downloads stay disabled until you enable them.</p>
      <dl class="welcome-actions"><div><dt>Enable for a project or Global</dt><dd>Make the group available to your agent. Disable it later; the files stay ready.</dd></div><div><dt>Read group once</dt><dd>Copy a command for your agent to read the group’s instructions. Activation stays unchanged.</dd></div></dl></section>
    <section class="welcome-section"><h3>Write your agent rules once</h3><p>Edit and save AGENTS.md here, then preview and sync it to Codex, Claude, or a custom file. AFK preserves text outside its marked region and backs up existing files.</p></section>
    <details class="welcome-extra"><summary>Skills, tools, and your portable setup</summary><ul>
      <li><strong>Installed Skills:</strong> inspect instructions, switch availability, and choose manual or automatic invocation.</li>
      <li><strong>Sources &amp; Stacks:</strong> bookmark repositories or save a group of selected skills from multiple sources. Copy install commands to run yourself. Update controls also copy commands for you to run.</li>
      <li><strong>Tools:</strong> save global install and update commands. Running one is an explicit action.</li>
      <li><strong>Settings:</strong> define project folders and choose where settings and rule files live. Export the AFK folder to take them with you.</li>
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

function welcomeGo(target){
  const startsProfile=target==='Profiles'&&!profiles.length;
  rememberWelcome();closeModal();navigate(target);
  if(startsProfile)createProfile();
}

$('sheet').addEventListener('cancel',rememberWelcome);
$('sheet').addEventListener('close',()=>{
  if(!welcomeActive)return;
  rememberWelcome();
  (matchMedia('(max-width:760px)').matches?$('mobileSection'):document.querySelector('#nav [aria-current]'))?.focus();
});
