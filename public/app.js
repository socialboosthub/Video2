const $ = s => document.querySelector(s);
let plan = null;
let chars = JSON.parse(localStorage.getItem('ahm_chars_v71') || '[]');

const GOLDEN = `THE GOLDEN FISH

STYLE: Cinematic live-action fantasy, realistic human actors, natural faces, dramatic lighting, realistic ocean, film-quality camera work.

CHARACTER: ELIAS
ROLE: 45-year-old poor fisherman
LOOK: Weathered kind face, short dark-brown hair, short dark beard, lean build, brown eyes, worn beige shirt, dark brown trousers, old leather sandals.
PERSONALITY: Kind, humble, hardworking, patient, compassionate.
VOICE: Warm, deep, gentle male voice.

CHARACTER: MARA
ROLE: 40-year-old fisherman's wife
LOOK: Long dark-brown hair, expressive brown eyes, medium build, simple worn blue dress.
PERSONALITY: Loving at first, increasingly ambitious and greedy.
VOICE: Natural adult female voice, emotional and demanding as the story progresses.

CHARACTER: GOLDEN FISH
ROLE: Ancient magical talking fish
LOOK: Magnificent realistic golden scales, glowing eyes, subtle magical golden light.
PERSONALITY: Wise, mysterious, calm and powerful.
VOICE: Calm supernatural voice.

SCENE 1 — THE POOR FISHERMAN
LOCATION:
Small coastal fishing village beside the ocean. Early morning.
ACTION:
Elias prepares his old fishing equipment outside their small weathered wooden home.
Mara stands in the doorway watching him.
Elias walks toward the ocean.
DIALOGUE:
MARA: "Elias, please catch something today."
ELIAS: "Don't worry, Mara. I'll do my best."
EMOTION:
Mara is worried. Elias is hopeful and reassuring.
SOUND:
Ocean waves, seabirds, morning wind.

SCENE 2 — THE GOLDEN FISH
LOCATION:
On a small wooden fishing boat in the ocean. Morning.
ACTION:
Elias throws his net into the water.
He waits.
He pulls the net back and finds nothing.
He throws it again.
The net suddenly becomes extremely heavy.
Elias struggles and pulls harder.
A bright golden light shines through the net.
Elias pulls out a magnificent glowing golden fish.
DIALOGUE:
ELIAS: "What...?"
GOLDEN FISH: "Please... don't kill me."
EMOTION:
Elias is shocked and confused. The fish is calm and mysterious.
SOUND:
Ocean waves, boat creaking, splashing water and magical shimmer.`;

function esc(s){return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function wordCount(){ $('#wordBadge').textContent = `${($('#screenplay').value.trim().match(/\S+/g)||[]).length} words`; }
function apiError(r,data){ return data?.error || `Request failed (${r.status}).`; }
async function jsonFetch(url,options={}){
  const r=await fetch(url,options); const text=await r.text(); let data;
  try{data=JSON.parse(text)}catch{throw new Error(`Server returned non-JSON (${r.status}). ${text.slice(0,180)}`)}
  if(!r.ok) throw new Error(apiError(r,data)); return data;
}

$('#screenplay').addEventListener('input',wordCount);
$('#loadTest').onclick=()=>{$('#screenplay').value=GOLDEN;wordCount();$('#scriptStatus').textContent='Golden Fish test loaded. Build the plan — no GPU request.'};
$('#clearScript').onclick=()=>{$('#screenplay').value='';plan=null;wordCount();$('#planView').classList.add('hidden');$('#generate').disabled=true;$('#directorStatus').textContent='Ready.'};
$('#newBtn').onclick=()=>{$('#clearScript').click();window.scrollTo({top:0,behavior:'smooth'})};

function renderChars(){
  const box=$('#chars'); box.innerHTML='';
  if(!chars.length){box.innerHTML='<div class="muted">No saved characters yet. Add Elias, Mara, villains, heroes or creatures.</div>';return;}
  for(const c of chars){const d=document.createElement('div');d.className='char';d.innerHTML=`<h3>${esc(c.name)}</h3><p><b>${esc(c.role||'')}</b></p><p>${esc(c.look||'')}</p><div class="mini"><button class="secondary" data-edit="${esc(c.id)}">Edit</button><button class="secondary danger" data-del="${esc(c.id)}">Delete</button></div>`;box.appendChild(d)}
  box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editChar(b.dataset.edit));
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{chars=chars.filter(c=>c.id!==b.dataset.del);localStorage.setItem('ahm_chars_v71',JSON.stringify(chars));renderChars()});
}
function editChar(id){const c=chars.find(x=>x.id===id);if(!c)return;$('#charId').value=c.id;$('#cName').value=c.name;$('#cRole').value=c.role||'';$('#cLook').value=c.look||'';$('#cPersonality').value=c.personality||'';$('#cVoice').value=c.voice||'';$('#charTitle').textContent='Edit Character';$('#charModal').classList.remove('hidden')}
$('#addChar').onclick=()=>{['charId','cName','cRole','cLook','cPersonality','cVoice'].forEach(x=>$('#'+x).value='');$('#charTitle').textContent='Add Character';$('#charModal').classList.remove('hidden')};
$('#closeChar').onclick=()=>$('#charModal').classList.add('hidden');
$('#saveChar').onclick=()=>{const name=$('#cName').value.trim();if(!name)return alert('Character name is required.');const cid=$('#charId').value||crypto.randomUUID();const c={id:cid,name,role:$('#cRole').value.trim(),look:$('#cLook').value.trim(),personality:$('#cPersonality').value.trim(),voice:$('#cVoice').value.trim()};const i=chars.findIndex(x=>x.id===cid);if(i>=0)chars[i]=c;else chars.push(c);localStorage.setItem('ahm_chars_v71',JSON.stringify(chars));renderChars();$('#charModal').classList.add('hidden')};

$('#settingsBtn').onclick=async()=>{try{const s=await jsonFetch('/api/settings');$('#mode').value=s.mode||'serverless';$('#endpoint').value=s.endpointId||'';$('#workerUrl').value=s.workerUrl||'';$('#apiKey').value='';$('#settingsStatus').textContent=s.hasApiKey?'API key is saved on the server.':'No API key saved. You can use the Director without one.'}catch(e){$('#settingsStatus').textContent=e.message}$('#settingsModal').classList.remove('hidden')};
$('#closeSettings').onclick=()=>$('#settingsModal').classList.add('hidden');
$('#clearKey').onclick=async()=>{try{await jsonFetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clearApiKey:true})});$('#apiKey').value='';$('#settingsStatus').textContent='Saved API key cleared.'}catch(e){$('#settingsStatus').textContent=e.message}};
$('#saveSettings').onclick=async()=>{try{const body={mode:$('#mode').value,endpointId:$('#endpoint').value.trim(),workerUrl:$('#workerUrl').value.trim()};if($('#apiKey').value.trim())body.apiKey=$('#apiKey').value.trim();const d=await jsonFetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});$('#settingsStatus').textContent=d.hasApiKey?'Settings saved. API key is stored server-side.':'Settings saved. No API key is currently stored.'}catch(e){$('#settingsStatus').textContent=e.message}};

function renderPlan(p){
  let h=`<div class="plan-meta"><div class="pill">${p.validation.explicitScenes} story scenes locked</div><div class="pill">${p.validation.actualEpisodes} parts</div><div class="pill">${p.validation.dialogueLines} dialogue lines locked</div><div class="pill">${p.validation.shots} compact GPU shots</div></div>`;
  h+=`<div class="plan"><b>AHM DIRECTOR V7.1</b>\nFormat: ${esc(p.format)}\nTarget: ${p.targetLength}s\nSubtitles: ${p.subtitles?'EXACT DIALOGUE':'OFF'}\nNarrator: ${p.noNarrator?'OFF unless scripted':'ALLOWED'}\n\nGLOBAL STYLE\n${esc((p.global.style||[]).join('\n'))}\n\nCONTINUITY LOCK\nCharacter identity, voice, wardrobe, props, geography and chronological story events remain locked. No invented story events.</div>`;
  p.episodes.forEach(e=>{h+=`<details class="episode" open><summary>PART ${e.episode} — ${e.duration}s • ${e.scenes.length} scene(s)</summary>`;e.scenes.forEach(s=>{h+=`<div class="scene"><h4>SCENE ${s.number} — ${esc(s.title)} <span class="muted">(${s.duration}s)</span></h4><div><b>LOCATION</b><p>${esc(s.location)}</p></div><div><b>ACTION</b><p>${esc(s.action.join('\n'))}</p></div><div><b>DIALOGUE — LOCKED</b>`;s.dialogue.forEach(d=>{h+=`<div class="shot dialogue"><b>${esc(d.speaker)}:</b> ${esc(d.text)}</div>`});h+=`</div><div><b>GPU SHOT PLAN (${s.shots.length})</b>`;s.shots.forEach((sh,i)=>{h+=`<div class="shot"><b>${i+1}. ${esc(sh.type)} — ${esc(sh.camera)}</b><br>${esc(sh.visual)}</div>`});h+=`</div></div>`});h+='</details>'});
  $('#planView').innerHTML=h;
}

$('#build').onclick=async()=>{const screenplay=$('#screenplay').value.trim();if(!screenplay)return alert('Paste your screenplay first.');$('#directorStatus').textContent='Director is parsing and locking your story locally…';$('#build').disabled=true;try{plan=await jsonFetch('/api/director/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screenplay,characters:chars,episodes:Number($('#parts').value),visualStyle:$('#style').value,format:$('#format').value,targetLength:Number($('#length').value),subtitle:$('#subtitles').value==='true',noNarrator:$('#noNarrator').checked})});renderPlan(plan);$('#planView').classList.remove('hidden');$('#generate').disabled=false;$('#directorStatus').textContent='Plan ready. No RunPod request was made.';window.scrollTo({top:$('#planView').getBoundingClientRect().top+scrollY-70,behavior:'smooth'})}catch(e){$('#directorStatus').textContent=e.message;$('#directorStatus').className='status bad'}finally{$('#build').disabled=false}};

$('#saveDraft').onclick=async()=>{if(!$('#screenplay').value.trim())return alert('Nothing to save.');try{await jsonFetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('#screenplay').value.split('\n').find(Boolean)?.slice(0,80)||'Untitled',screenplay:$('#screenplay').value,characters:chars,plan})});$('#scriptStatus').textContent='Draft saved on the server.'}catch(e){$('#scriptStatus').textContent=e.message}};

$('#generate').onclick=async()=>{if(!plan)return;const s=await jsonFetch('/api/settings');if(!s.hasApiKey)return alert('No RunPod API key is configured. Build plans freely; save your key only when you are ready to pay for GPU generation.');if(!confirm('This is the PAID step. A RunPod job will be submitted. Continue?'))return;$('#generate').disabled=true;$('#directorStatus').textContent='Submitting GPU job…';try{const d=await jsonFetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(plan)});$('#generationView').classList.remove('hidden');$('#generationView').innerHTML=`<div class="result"><b>GPU job submitted.</b><p>Job ID: <code>${esc(d.id||'unknown')}</code></p><pre>${esc(JSON.stringify(d,null,2))}</pre></div>`;$('#directorStatus').textContent='Job submitted. Monitoring status…';if(d.id)pollJob(d.id)}catch(e){$('#directorStatus').textContent=e.message;$('#directorStatus').className='status bad'}finally{$('#generate').disabled=false}};
async function pollJob(jobId){for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,5000));try{const d=await jsonFetch('/api/job-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:jobId})});$('#generationView').innerHTML=`<div class="result"><b>RunPod Job</b><p>Status: <strong>${esc(d.status||'UNKNOWN')}</strong></p><pre>${esc(JSON.stringify(d,null,2))}</pre></div>`;if(d.status==='COMPLETED'){ $('#directorStatus').textContent='GPU generation completed.';return }if(['FAILED','ERROR','CANCELLED','TIMED_OUT'].includes(d.status)){ $('#directorStatus').textContent=`GPU job ended: ${d.status}`;return }}catch(e){$('#generationView').innerHTML=`<div class="result bad">Status check failed: ${esc(e.message)}<br>Job ID: ${esc(jobId)}</div>`}}}

renderChars();wordCount();
