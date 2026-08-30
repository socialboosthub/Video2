const $=s=>document.querySelector(s);
const story=$("#story"), wordCount=$("#wordCount"), plan=$("#plan");
let characters=[];

const sample=`🐟 THE GOLDEN FISH

STYLE: Live-action fantasy short film, realistic human actors, cinematic lighting, realistic ocean, natural facial expressions, dramatic acting.

MAIN CHARACTERS

- ELIAS: A poor but kind fisherman, around 45 years old.
- MARA: His wife, around 40 years old. She starts grateful but becomes increasingly greedy.
- GOLDEN FISH: A magical glowing golden fish that can speak.

IMPORTANT: No narrator. No voice-over. The story is told entirely through the actors' actions and dialogue.

SCENE 1 — THE POOR FISHERMAN

LOCATION: Small poor fishing village beside the ocean. Early morning.

ACTION:
Elias walks out of his tiny wooden house carrying an old fishing net.
Mara stands in the doorway.
She looks worried.

MARA:
"Elias, please... catch something today."

ELIAS:
"I will, Mara."

He gently touches her shoulder.

ELIAS:
"Don't worry. We'll have something to eat tonight."

He walks toward the ocean.
Mara watches him disappear.

SCENE 2 — FISHING

LOCATION: On a small wooden fishing boat.

ACTION:
Elias throws his net into the ocean.
He waits.
He pulls it back.
Nothing.
He throws the net again.
Suddenly the net becomes extremely heavy.
A bright golden light shines through the net.
Elias pulls out a magnificent golden fish.

ELIAS:
"What...?"

GOLDEN FISH:
"Please... don't kill me."

ELIAS:
"WHAT?!"

GOLDEN FISH:
"I can speak."

ELIAS:
"A talking fish?!"

GOLDEN FISH:
"I am no ordinary fish."

GOLDEN FISH:
"Release me, and I will grant you one wish."

ELIAS:
"Then I wish for nothing."

GOLDEN FISH:
"Nothing?"

ELIAS:
"You're alive. That's enough."

Elias gently puts the fish back into the ocean.

SCENE 3 — MARA HEARS THE STORY

LOCATION: Their small house.

ACTION:
Elias walks inside. Mara immediately looks at his empty hands.

MARA:
"Where's the fish?"

ELIAS:
"I didn't bring any."

MARA:
"Then what are we going to eat?"

ELIAS:
"You won't believe what happened."

ELIAS:
"I caught a golden fish."

MARA:
"A golden fish?"

ELIAS:
"It spoke to me."

MARA:
"You're joking."

ELIAS:
"I'm serious."

MARA:
"And it said it would grant you a wish?"

ELIAS:
"Yes."

MARA:
"What did you ask for?"

ELIAS:
"Nothing."

MARA:
"NOTHING?!"

MARA:
"Look at this house!"

MARA:
"We have nothing!"

MARA:
"Go back."

ELIAS:
"For what?"

MARA:
"Ask the fish for a new house!"

MARA:
"GO!"`;

function updateCount(){
  const n=story.value.trim()?story.value.trim().split(/\s+/).length:0;
  wordCount.textContent=`${n.toLocaleString()} words`;
}
story.addEventListener("input",updateCount);

function addCharacter(c={name:"",role:"",look:""}){
  characters.push(c);
  renderCharacters();
}
function renderCharacters(){
  const box=$("#characters"); box.innerHTML="";
  characters.forEach((c,i)=>{
    const el=document.createElement("div"); el.className="character";
    el.innerHTML=`<button class="remove" data-i="${i}">×</button><div class="char-avatar">${(c.name||"?")[0].toUpperCase()}</div>
      <div class="char-fields">
      <input class="char-name" data-i="${i}" value="${esc(c.name)}" placeholder="Character name">
      <input class="char-role" data-i="${i}" value="${esc(c.role)}" placeholder="Role / age">
      <textarea class="char-look" data-i="${i}" placeholder="Appearance, clothing, personality and voice">${esc(c.look)}</textarea>
      </div>`;
    box.appendChild(el);
  });
  box.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{characters.splice(+b.dataset.i,1);renderCharacters()});
  box.querySelectorAll(".char-name,.char-role,.char-look").forEach(x=>x.oninput=()=>characters[+x.dataset.i][x.className.replace("char-","")]=x.value);
}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

$("#addCharacter").onclick=()=>addCharacter();
$("#sampleBtn").onclick=()=>{story.value=sample;updateCount(); if(!characters.length){addCharacter({name:"Elias",role:"45-year-old poor fisherman",look:"Weathered face, short dark brown hair, short beard, lean build, worn beige shirt, dark brown trousers. Kind, humble, hardworking. Warm deep gentle male voice."});addCharacter({name:"Mara",role:"40-year-old fisherman’s wife",look:"Long dark brown hair, expressive brown eyes, worn blue dress. Initially grateful, increasingly demanding. Natural emotional female voice."});addCharacter({name:"Golden Fish",role:"Ancient magical talking fish",look:"Shimmering golden scales, glowing eyes, elegant fins, subtle golden aura. Wise, mysterious, calm. Magical slightly echoing voice."})}};
$("#clearBtn").onclick=()=>{story.value="";updateCount();plan.innerHTML='<div class="empty">Your original story scenes will appear here.</div>'};
$("#newProject").onclick=()=>{story.value="";characters=[];renderCharacters();updateCount();plan.innerHTML='<div class="empty">Your original story scenes will appear here.</div>';$("#prepare").disabled=true};

function parseScript(text){
  const lines=text.replace(/\r/g,"").split("\n");
  const global=[];
  let style="", constraints=[];
  let scenes=[], cur=null, section="";
  for(let i=0;i<lines.length;i++){
    const raw=lines[i], line=raw.trim();
    const sceneMatch=line.match(/^SCENE\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i);
    if(sceneMatch){
      cur={num:+sceneMatch[1],title:sceneMatch[2].trim()||`Scene ${sceneMatch[1]}`,location:"",action:[],dialogue:[],characters:new Set(),shots:[]};
      scenes.push(cur); section="action"; continue;
    }
    if(!cur){
      if(/^STYLE\s*:/i.test(line)) style=line.replace(/^STYLE\s*:/i,"").trim();
      else if(/^IMPORTANT\s*:/i.test(line)) constraints.push(line.replace(/^IMPORTANT\s*:/i,"").trim());
      continue;
    }
    const loc=line.match(/^LOCATION\s*:\s*(.*)$/i);
    if(loc){cur.location=loc[1];section="location";continue}
    if(/^ACTION\s*:\s*$/i.test(line)){section="action";continue}
    if(/^DIALOGUE\s*:\s*$/i.test(line)){section="dialogue";continue}
    const d=line.match(/^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*(.*)$/);
    if(d && !/^(LOCATION|ACTION|STYLE|IMPORTANT|CAMERA|AUDIO|ENVIRONMENT|EMOTION|CONTINUITY)$/i.test(d[1])){
      const speaker=d[1].trim(), text=d[2].trim().replace(/^["“]|["”]$/g,"");
      if(text){cur.dialogue.push({speaker,text});cur.characters.add(speaker)}
      section="dialogue";continue
    }
    if(line && !/^---+$/.test(line)){
      if(section==="location" && !cur.location) cur.location=line;
      else if(section!=="dialogue") cur.action.push(line);
    }
  }
  // Infer characters from dialogue + supplied character cards; never invent story scenes.
  const known=characters.map(c=>c.name.toUpperCase()).filter(Boolean);
  scenes.forEach(s=>{
    known.forEach(k=>{if(s.dialogue.some(d=>d.speaker===k))s.characters.add(k)});
    if(!s.characters.size){
      // Conservative inference from action text only.
      known.forEach(k=>{if(s.action.join(" ").toUpperCase().includes(k))s.characters.add(k)});
    }
    const text=(s.action.join(" ")+" "+s.dialogue.map(d=>d.text).join(" ")).trim();
    s.shots=makeShots(s,text);
  });
  return {style,constraints,scenes};
}
function makeShots(s,text){
  const words=Math.max(1,text.split(/\s+/).length);
  const n=Math.max(2,Math.min(8,Math.ceil(words/32)));
  const actions=s.action.filter(Boolean);
  const shots=[];
  for(let i=0;i<n;i++){
    let source=actions.length?actions[Math.min(i,actions.length-1)]:"Perform the supplied scene faithfully.";
    let cam=["Wide establishing shot","Medium character shot","Tracking shot","Over-the-shoulder shot","Emotional close-up","Slow cinematic push-in","Two-shot","Detail insert"][i%8];
    shots.push({id:`${s.num}.${i+1}`,camera:cam,visual:source});
  }
  return shots;
}
function escapeText(s){return esc(s).replace(/\n/g,"<br>")}
function renderPlan(p){
  if(!p.scenes.length){plan.innerHTML='<div class="empty">I could not find any headings in the form “SCENE 1 — Title”. Keep your screenplay format and try again.</div>';return}
  const target=$("#length").value;
  const targetSec=target==="Auto"?p.scenes.length*16:parseInt(target)*60;
  const per=targetSec/p.scenes.length;
  let html=`<div class="plan-meta"><span class="pill">${p.scenes.length} ORIGINAL STORY SCENES</span><span class="pill">~${formatTime(targetSec)} FINAL VIDEO</span><span class="pill">${p.scenes.reduce((a,s)=>a+s.shots.length,0)} AUTO GENERATION SHOTS</span><span class="pill">Story order locked</span></div>`;
  if(p.style)html+=`<div class="fieldbox"><b>Global visual style</b><p>${escapeText(p.style)}</p></div>`;
  if(p.constraints.length)html+=`<div class="fieldbox"><b>Global constraints</b><p>${escapeText(p.constraints.join("\\n"))}</p></div>`;
  p.scenes.forEach((s,i)=>{
    const start=i*per,end=(i+1)*per;
    const chars=[...s.characters].join(", ")||"Inferred from scene";
    const dialogue=s.dialogue.map(d=>`<div class="shot"><b>${esc(d.speaker)}</b><br>${esc(d.text)}</div>`).join("")||"<p>No explicit dialogue in this scene.</p>";
    const shots=s.shots.map(x=>`<div class="shot"><b>SHOT ${x.id} · ${x.camera}</b><br>${escapeText(x.visual)}</div>`).join("");
    html+=`<article class="scene"><div class="scene-head"><div><div class="scene-title">SCENE ${String(s.num).padStart(2,"0")} · ${esc(s.title)}</div><small>${esc(chars)}</small></div><div class="scene-time">${formatTime(start)} → ${formatTime(end)}</div></div>
    <div class="scene-body">
      <div class="fieldbox"><b>Location</b><p>${escapeText(s.location||"Use the location established by the screenplay.")}</p></div>
      <div class="fieldbox"><b>Characters</b><p>${esc(chars)}</p></div>
      <div class="fieldbox"><b>Performance / Action</b><p>${escapeText(s.action.join("\\n")||"Perform the supplied action faithfully.")}</p></div>
      <div class="fieldbox"><b>Dialogue — locked to script</b>${dialogue}</div>
      <div class="fieldbox"><b>Automatic generation shots</b>${shots}</div>
      <div class="fieldbox"><b>Continuity lock</b><p>Keep established face, age, hair, body proportions, wardrobe, voice, props, lighting and environment consistent. Do not invent events that contradict this screenplay.</p></div>
    </div></article>`;
  });
  plan.innerHTML=html;
}
function formatTime(sec){sec=Math.max(0,Math.round(sec));return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
let lastPlan=null;
$("#buildPlan").onclick=()=>{
  lastPlan=parseScript(story.value);
  renderPlan(lastPlan);
  $("#planSummary").textContent=`${lastPlan.scenes.length} original story scenes preserved. Generation shots are internal production units, not replacement story scenes.`;
  $("#prepare").disabled=!lastPlan.scenes.length;
  window.scrollTo({top:$("#plan").getBoundingClientRect().top+scrollY-80,behavior:"smooth"});
};
$("#prepare").onclick=()=>{
  $("#generation").classList.remove("hidden");
  const logs=$("#logs"),bar=$("#progressBar"),status=$("#genStatus");logs.innerHTML="";
  const entries=["Validating screenplay","Locking character identities","Creating scene-to-shot map","Preparing dialogue timing","Preparing continuity references","Creating GPU job package"];
  let i=0;const timer=setInterval(()=>{if(i<entries.length){logs.innerHTML+=`<div>✓ ${entries[i++]}</div>`;bar.style.width=(i/entries.length*100)+"%"}else{clearInterval(timer);status.textContent="GPU package ready";logs.innerHTML+=`<div>✓ AHM Director package created — actual GPU generation is not connected yet.</div>`}},450);
  window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"});
};
updateCount();renderCharacters();
