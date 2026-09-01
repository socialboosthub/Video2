const $=s=>document.querySelector(s);
let plan=null;
let chars=JSON.parse(localStorage.getItem("ahm_chars_v80")||"[]");

const GOLDEN=`THE GOLDEN FISH

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

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function wordCount(){$("#wordBadge").textContent=`${($("#screenplay").value.trim().match(/\S+/g)||[]).length} words`;}
function apiError(r,d){return d?.error||`Request failed (${r.status}).`;}
async function jsonFetch(url,opt={}){
  const r=await fetch(url,opt); const t=await r.text(); let d;
  try{d=JSON.parse(t)}catch{throw new Error(`Server returned non-JSON (${r.status}). ${t.slice(0,180)}`)}
  if(!r.ok)throw new Error(apiError(r,d)); return d;
}
function setStatus(text,bad=false){$("#directorStatus").textContent=text;$("#directorStatus").className=bad?"status bad":"status";}

async function refreshHealth(){
  try{
    const d=await jsonFetch("/api/health");
    $("#systemStatus").innerHTML=`<i></i> ${d.runpodConfigured?"RunPod Ready":"Director Ready"}`;
  }catch(e){$("#systemStatus").innerHTML=`<i></i> Offline`;$("#systemStatus").style.color="var(--danger)"}
}
async function refreshSettings(){
  try{
    const s=await jsonFetch("/api/settings");
    $("#setupBox").innerHTML=`
      <p><b>Server status:</b> ${esc(s.environment)}</p>
      <p><b>RunPod API key:</b> ${s.hasApiKey?"<span class='good'>Configured</span>":"<span class='bad'>Missing</span>"}</p>
      <p><b>Endpoint ID:</b> ${s.hasEndpoint?"<span class='good'>Configured</span>":"<span class='bad'>Missing</span>"}</p>
      <p><b>Worker mode:</b> <code>${esc(s.workerMode)}</code></p>
      <hr>
      <b>For Render:</b>
      <ol>
        <li>Open your Render service → <b>Environment</b>.</li>
        <li>Add <code>RUNPOD_API_KEY</code>.</li>
        <li>Add <code>RUNPOD_ENDPOINT_ID</code>.</li>
        <li>For a free contract test use <code>AHM_WORKER_MODE=demo</code>.</li>
        <li>Redeploy after saving the variables.</li>
      </ol>
      <p class="hint">The secret is intentionally never accepted by this browser page.</p>`;
  }catch(e){$("#setupBox").innerHTML=`<p class="bad">${esc(e.message)}</p>`}
}

$("#screenplay").addEventListener("input",wordCount);
$("#loadTest").onclick=()=>{$("#screenplay").value=GOLDEN;wordCount();$("#scriptStatus").textContent="Golden Fish test loaded. Build the plan — no GPU request.";};
$("#clearScript").onclick=()=>{$("#screenplay").value="";plan=null;wordCount();$("#planView").classList.add("hidden");$("#generate").disabled=true;setStatus("Ready.");};
$("#newBtn").onclick=()=>{$("#clearScript").click();scrollTo({top:0,behavior:"smooth"});};
$("#healthBtn").onclick=refreshHealth;
$("#settingsBtn").onclick=async()=>{$("#settingsModal").classList.remove("hidden");await refreshSettings();};
$("#refreshSettings").onclick=refreshSettings;
$("#closeSettings").onclick=()=>$("#settingsModal").classList.add("hidden");
$("#closeChar").onclick=()=>$("#charModal").classList.add("hidden");

function renderChars(){
  const box=$("#chars");box.innerHTML="";
  if(!chars.length){box.innerHTML='<div class="muted">No saved characters yet.</div>';return;}
  for(const c of chars){
    const d=document.createElement("div");d.className="char";
    d.innerHTML=`<h3>${esc(c.name)}</h3><p><b>${esc(c.role||"")}</b></p><p>${esc(c.look||"")}</p><div class="mini"><button class="secondary" data-edit="${esc(c.id)}">Edit</button><button class="secondary danger" data-del="${esc(c.id)}">Delete</button></div>`;
    box.appendChild(d);
  }
  box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editChar(b.dataset.edit));
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{chars=chars.filter(c=>c.id!==b.dataset.del);localStorage.setItem("ahm_chars_v80",JSON.stringify(chars));renderChars();});
}
function editChar(id){
  const c=chars.find(x=>x.id===id);if(!c)return;
  $("#charId").value=c.id;$("#cName").value=c.name;$("#cRole").value=c.role||"";$("#cLook").value=c.look||"";$("#cPersonality").value=c.personality||"";$("#cVoice").value=c.voice||"";
  $("#charTitle").textContent="Edit Character";$("#charModal").classList.remove("hidden");
}
$("#addChar").onclick=()=>{["charId","cName","cRole","cLook","cPersonality","cVoice"].forEach(x=>$("#"+x).value="");$("#charTitle").textContent="Add Character";$("#charModal").classList.remove("hidden");};
$("#saveChar").onclick=()=>{
  const name=$("#cName").value.trim();if(!name)return alert("Character name is required.");
  const cid=$("#charId").value||crypto.randomUUID();const c={id:cid,name,role:$("#cRole").value.trim(),look:$("#cLook").value.trim(),personality:$("#cPersonality").value.trim(),voice:$("#cVoice").value.trim()};
  const i=chars.findIndex(x=>x.id===cid);if(i>=0)chars[i]=c;else chars.push(c);
  localStorage.setItem("ahm_chars_v80",JSON.stringify(chars));renderChars();$("#charModal").classList.add("hidden");
};

function renderPlan(p){
  let h=`<div class="plan-meta">
  <div class="pill">${p.validation.explicitScenes} scenes locked</div>
  <div class="pill">${p.validation.actualEpisodes} parts</div>
  <div class="pill">${p.validation.dialogueLines} dialogue lines</div>
  <div class="pill">${p.validation.shots} GPU shots</div></div>`;
  h+=`<div class="plan"><b>AHM DIRECTOR V8</b>
Format: ${esc(p.format)}
Target: ${p.targetLength}s
Subtitles: ${p.subtitles?"EXACT DIALOGUE":"OFF"}
Narrator: ${p.noNarrator?"OFF unless scripted":"ALLOWED"}

GLOBAL STYLE
${esc((p.global.style||[]).join("\n")||p.visualStyle)}

CONTINUITY LOCK
Character identity, voice, wardrobe, props, geography and chronological story events remain locked. No invented story events.</div>`;
  p.episodes.forEach(e=>{
    h+=`<details class="episode" open><summary>PART ${e.episode} — ${e.duration}s • ${e.scenes.length} scene(s)</summary>`;
    e.scenes.forEach(s=>{
      h+=`<div class="scene"><h4>SCENE ${s.number} — ${esc(s.title)} <span class="muted">(${s.duration}s)</span></h4>
      <div><b>LOCATION</b><p>${esc(s.location)}</p></div>
      <div><b>ACTION</b><p>${esc(s.action.join("\n"))}</p></div>
      <div><b>DIALOGUE — LOCKED</b>`;
      s.dialogue.forEach(d=>h+=`<div class="shot dialogue"><b>${esc(d.speaker)}:</b> ${esc(d.text)}</div>`);
      h+=`</div><div><b>GPU SHOT PLAN (${s.shots.length})</b>`;
      s.shots.forEach((sh,i)=>h+=`<div class="shot"><b>${i+1}. ${esc(sh.type)} — ${esc(sh.camera)}</b><br>${esc(sh.visual)}</div>`);
      h+=`</div></div>`;
    });
    h+="</details>";
  });
  $("#planView").innerHTML=h;
}

$("#build").onclick=async()=>{
  const screenplay=$("#screenplay").value.trim();if(!screenplay)return alert("Paste your screenplay first.");
  setStatus("Director is parsing, locking continuity and building shots…");$("#build").disabled=true;
  try{
    plan=await jsonFetch("/api/director/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      screenplay,characters:chars,episodes:Number($("#parts").value),visualStyle:$("#style").value,format:$("#format").value,targetLength:Number($("#length").value),subtitle:$("#subtitles").value==="true",noNarrator:$("#noNarrator").checked
    })});
    renderPlan(plan);$("#planView").classList.remove("hidden");$("#generate").disabled=false;setStatus("Plan ready. No GPU request was made.");
    scrollTo({top:$("#planView").getBoundingClientRect().top+scrollY-70,behavior:"smooth"});
  }catch(e){setStatus(e.message,true)}finally{$("#build").disabled=false;}
};

async function submitRunPod(testOnly=false){
  if(!plan)return alert("Build the Director plan first.");
  if(testOnly && !confirm("This submits a small DEMO contract test to RunPod. In demo worker mode it does not render video. Continue?"))return;
  if(!testOnly && !confirm("This submits a PAID GPU job to RunPod. Continue?"))return;
  $("#testGpu").disabled=true;$("#generate").disabled=true;setStatus(testOnly?"Submitting RunPod test…":"Submitting GPU generation…");
  try{
    const d=await jsonFetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan,testOnly})});
    $("#generationView").classList.remove("hidden");
    $("#generationView").innerHTML=`<div class="result"><b>RunPod job submitted.</b><p>Job ID: <code>${esc(d.id||"unknown")}</code></p><pre>${esc(JSON.stringify(d,null,2))}</pre></div>`;
    setStatus("Job submitted. Monitoring status…");if(d.id)pollJob(d.id);
  }catch(e){setStatus(e.message,true);$("#generationView").classList.remove("hidden");$("#generationView").innerHTML=`<div class="result bad">${esc(e.message)}</div>`}
  finally{$("#testGpu").disabled=false;$("#generate").disabled=false;}
}
$("#testGpu").onclick=()=>submitRunPod(true);
$("#generate").onclick=()=>submitRunPod(false);

async function pollJob(jobId){
  for(let i=0;i<240;i++){
    await new Promise(r=>setTimeout(r,5000));
    try{
      const d=await jsonFetch("/api/job-status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:jobId})});
      const out=d.output?`<p><b>Output:</b></p><pre>${esc(JSON.stringify(d.output,null,2))}</pre>`:"";
      $("#generationView").innerHTML=`<div class="result"><b>RunPod Job</b><p>Status: <strong>${esc(d.status||"UNKNOWN")}</strong></p>${out}<pre>${esc(JSON.stringify({...d,output:undefined},null,2))}</pre></div>`;
      if(d.status==="COMPLETED"){setStatus("RunPod job completed.");return;}
      if(["FAILED","ERROR","CANCELLED","TIMED_OUT"].includes(d.status)){setStatus(`GPU job ended: ${d.status}`,true);return;}
    }catch(e){$("#generationView").innerHTML=`<div class="result bad">Status check failed: ${esc(e.message)}<br>Job ID: ${esc(jobId)}</div>`;return;}
  }
  setStatus("Stopped polling after 20 minutes. Check the RunPod job status.",true);
}

$("#saveDraft").onclick=async()=>{
  if(!$("#screenplay").value.trim())return alert("Nothing to save.");
  try{
    await jsonFetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:$("#screenplay").value.split("\n").find(Boolean)?.slice(0,80)||"Untitled",screenplay:$("#screenplay").value,characters:chars,plan})});
    $("#scriptStatus").textContent="Draft saved on the server filesystem.";
  }catch(e){$("#scriptStatus").textContent=e.message;}
};

renderChars();wordCount();refreshHealth();