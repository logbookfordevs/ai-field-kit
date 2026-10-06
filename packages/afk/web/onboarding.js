let welcomeActive=false,welcomeDismissedHere=false;

function maybeWelcome(){
  if(!currentSettings.welcomeDismissed&&!welcomeDismissedHere&&!$('sheet').open)showWelcome();
}

function showWelcome(){
  closeUtilities();
  const profileAction=profiles.length?'Open profiles':'Create my first profile';
  modal('Welcome to AFK 2.0',
    `<p class="welcome-intro">Keep your skills ready. Bring them into your work when you need them.</p>
    <section class="welcome-section"><h3>Start with a skill group</h3><p>A profile groups skills from a repository or this machine. New downloads stay disabled until you enable them.</p>
      <dl class="welcome-actions"><div><dt>Enable for a project or Global</dt><dd>Make the group available to your agent. Disable it later; the files stay ready.</dd></div><div><dt>Read group once</dt><dd>Copy a command for your agent to read the group’s instructions. Activation stays unchanged.</dd></div></dl></section>
    <section class="welcome-section"><h3>Write your agent rules once</h3><p>Edit and save AGENTS.md here, then preview and sync it to Codex, Claude, or a custom file. AFK preserves text outside its marked region and backs up existing files.</p></section>
    <details class="welcome-extra"><summary>Skills, tools, and your portable setup</summary><ul>
      <li><strong>Installed Skills:</strong> inspect instructions, switch availability, and choose manual or automatic invocation.</li>
      <li><strong>Favorite sources:</strong> bookmark repositories and copy install commands. Update controls also copy commands for you to run.</li>
      <li><strong>Tools:</strong> save global install and update commands. Running one is an explicit action.</li>
      <li><strong>Settings:</strong> define project folders and choose where settings and rule files live. Export the AFK folder to take them with you.</li>
    </ul></details>`,
    button('I’ll explore','closeModal()','text')+button('Open agent rules',"welcomeGo('Agent rules')")+button(profileAction,"welcomeGo('Profiles')",'primary'));
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
