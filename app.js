const $=s=>document.querySelector(s);
const story=$("#story"), wordCount=$("#wordCount"), plan=$("#plan");
const CHAR_KEY="ahm_character_library_v4";
const SETTINGS_KEY="ahm_settings_v4";
let characters=loadCharacters(), lastPlan=null;

const SAMPLE=`🐟 THE GOLDEN FISH
STYLE: Cinematic live-action fantasy short film, realistic human actors, cinematic lighting, realistic ocean, natural facial expressions, dramatic acting.

IMPORTANT: No narrator. The story is told through actors' actions and dialogue.

SCENE 1 — THE POOR FISHERMAN
LOCATION: Small poor fishing village beside the ocean. Early morning.
ACTION:
Elias walks out of his tiny wooden house carrying an old fishing net.
Mara stands in the doorway and looks worried.
DIALOGUE:
MARA: "Elias, please... catch something today."
ELIAS: "I will, Mara."
ELIAS: "Don't worry. We'll have something to eat tonight."
ACTION:
Elias gently touches Mara's shoulder and walks toward the ocean. Mara watches him disappear.

SCENE 2 — FISHING
LOCATION: A small wooden fishing boat on the ocean.
ACTION:
Elias throws his net into the ocean. He waits and pulls it back. Nothing. He throws it again. The net suddenly becomes extremely heavy. A bright golden light shines through it. Elias pulls out a magnificent golden fish.
DIALOGUE:
ELIAS: "Whoa! What is this?"
ELIAS: "What...?"
GOLDEN FISH: "Please... don't kill me."
ELIAS: "WHAT?!"
GOLDEN FISH: "I can speak."
ELIAS: "A talking fish?!"
GOLDEN FISH: "I am no ordinary fish."
GOLDEN FISH: "Release me, and I will grant you one wish."
ELIAS: "One wish?"
ELIAS: "Then I wish for nothing."
GOLDEN FISH: "Nothing?"
ELIAS: "You're alive. That's enough."
ACTION:
Elias gently puts the fish back into the ocean.

SCENE 3 — MARA HEARS THE STORY
LOCATION: Their small house.
ACTION:
Elias walks inside. Mara immediately looks at his empty hands. Elias sits down and explains what happened.
DIALOGUE:
MARA: "Where's the fish?"
ELIAS: "I didn't bring any."
MARA: "Then what are we going to eat?"
ELIAS: "You won't believe what happened."
ELIAS: "I caught a golden fish."
MARA: "A golden fish?"
ELIAS: "It spoke to me."
MARA: "You're joking."
ELIAS: "I'm serious."
MARA: "And it said it would grant you a wish?"
ELIAS: "Yes."
MARA: "What did you ask for?"
ELIAS: "Nothing."
MARA: "NOTHING?!"
ELIAS: "We're alive. That's enough."
MARA: "Look at this house!"
MARA: "We have nothing!"
MARA: "Go back."
ELIAS: "For what?"
MARA: "Ask the fish for a new house!"
ELIAS: "Mara..."
MARA: "GO!"

SCENE 4 — THE FIRST WISH
LOCATION: Ocean at sunset.
ACTION:
Elias stands on the beach. The ocean begins glowing. The golden fish rises from the water.
DIALOGUE:
ELIAS: "Golden fish..."
GOLDEN FISH: "Why have you returned?"
ELIAS: "My wife... she wants a better house."
GOLDEN FISH: "Very well."
ACTION:
The fish dives underwater. A golden wave spreads across the ocean.

SCENE 5 — THE NEW HOUSE
LOCATION: Outside their home.
ACTION:
Elias runs home and stops in shock. Their tiny hut has become a beautiful large house. Mara walks outside, amazed.
DIALOGUE:
MARA: "Elias!"
MARA: "Look at our house!"
ELIAS: "Are you happy?"
MARA: "Yes!"
ACTION:
Mara hugs Elias.

SCENE 6 — I WANT MORE
LOCATION: Inside the new house. Next morning.
ACTION:
Mara walks around the beautiful house and touches the furniture. Elias watches her.
DIALOGUE:
ELIAS: "You like it?"
MARA: "It's nice."
ELIAS: "Then what's wrong?"
MARA: "I don't want a house."
ELIAS: "What?"
MARA: "I want a palace."
ELIAS: "Mara..."
MARA: "Go back to the fish."

SCENE 7 — THE PALACE
LOCATION: Ocean under a darkening sky.
ACTION:
Elias returns to the water. The golden fish appears.
DIALOGUE:
ELIAS: "Golden fish..."
GOLDEN FISH: "Another wish?"
ELIAS: "My wife wants a palace."
GOLDEN FISH: "Very well."

SCENE 8 — THE PALACE
LOCATION: Palace interior.
ACTION:
A massive palace now stands where their house was. Mara walks through it in amazement. Servants carry food. Mara notices a huge throne.
DIALOGUE:
MARA: "This is beautiful!"
ELIAS: "Now are you happy?"
MARA: "Of course."
ACTION:
Mara's smile disappears as she looks at the throne.

SCENE 9 — SHE WANTS TO BE QUEEN
LOCATION: Palace throne room.
ACTION:
Mara walks slowly toward the throne and touches it. She sits down and looks at herself.
DIALOGUE:
MARA: "Why is there a throne?"
ELIAS: "Because it's a palace."
MARA: "A palace needs a queen."
ELIAS: "No."
MARA: "Take me back to the fish."
ELIAS: "Mara, please..."
MARA: "I want to be queen!"

SCENE 10 — QUEEN
LOCATION: Ocean during a darkening evening.
ACTION:
Elias stands at the ocean. The waves become stronger.
DIALOGUE:
ELIAS: "Golden fish..."
GOLDEN FISH: "Let me guess."
ELIAS: "She wants to be queen."
GOLDEN FISH: "Very well."

SCENE 11 — THE QUEEN
LOCATION: Royal castle throne room.
ACTION:
The palace transforms into an enormous royal castle. Mara sits on a golden throne wearing a crown. Hundreds of people bow before her.
DIALOGUE:
PEOPLE: "Long live the Queen!"
MARA: "Look at me!"
ELIAS: "You're finally happy?"
MARA: "No."
ELIAS: "What more could you possibly want?"
MARA: "I want to rule EVERYTHING."

SCENE 12 — THE FINAL DEMAND
LOCATION: Ocean during a violent storm. Rain and lightning.
ACTION:
Elias walks toward the water. The golden fish appears through the storm.
DIALOGUE:
ELIAS: "Golden fish!"
GOLDEN FISH: "Why have you come?"
ELIAS: "She wants to rule the entire land."
ELIAS: "And the sea."
GOLDEN FISH: "She wants to rule the sea?"
ELIAS: "She wants every creature to obey her."
GOLDEN FISH: "And what else?"
ELIAS: "She wants..."
ELIAS: "...you to serve her."
GOLDEN FISH: "She wants to rule the one thing that gave her everything?"
ACTION:
The fish disappears beneath the water.

SCENE 13 — EVERYTHING IS GONE
LOCATION: The old fishing village.
ACTION:
Elias returns home. The castle, servants and crown are gone. Mara stands in front of their old broken hut wearing her original clothes.
DIALOGUE:
MARA: "Elias..."
MARA: "Where is my castle?"
MARA: "Where are the servants?"
ELIAS: "Gone."
MARA: "What did you do?!"
ELIAS: "I did exactly what you asked."

SCENE 14 — REGRET
LOCATION: Inside the old hut.
ACTION:
Mara sees the leaking roof and broken table. She remembers the beautiful house, palace and castle. Her eyes fill with tears. Elias sits beside her.
DIALOGUE:
MARA: "I ruined everything..."
ELIAS: "We still have each other."
MARA: "I'm sorry."
ELIAS: "Then let's start again."

SCENE 15 — THE END
LOCATION: Beach at sunset.
ACTION:
Elias and Mara sit beside each other and share a small piece of bread. They watch the ocean and hold hands. The camera slowly moves toward the ocean. Underwater, the golden fish swims peacefully through the blue water and looks back toward shore.
DIALOGUE:
MARA: "You know..."
MARA: "I think this is enough."
ELIAS: "Yes."
GOLDEN FISH: "Sometimes... having everything means having nothing."
ACTION:
The fish swims away. Fade to black. THE END.`;

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function uid(){return "char_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)}
function loadCharacters(){try{return JSON.parse(localStorage.getItem(CHAR_KEY)||"[]")}catch{return[]}}
function saveCharacters(){localStorage.setItem(CHAR_KEY,JSON.stringify(characters))}
function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}catch{return{}}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify({provider:$("#provider").value,apiKey:$("#apiKey").value,workerEndpoint:$("#workerEndpoint").value}))}

function updateCount(){const n=story.value.trim()?story.value.trim().split(/\s+/).length:0;wordCount.textContent=n.toLocaleString()+" words"}
story.addEventListener("input",updateCount);

function renderCharacters(){
 const box=$("#characters"); box.innerHTML="";
 if(!characters.length){box.innerHTML='<div class="empty">No saved characters yet. Create Elias, Mara, villains, heroes, creatures, etc.</div>';return}
 characters.forEach((c,i)=>{
  const el=document.createElement("div");el.className="character";
  el.innerHTML=`<div class="char-avatar">${esc((c.name||"?")[0].toUpperCase())}</div>
  <div class="char-fields">
    <input class="char-name" data-i="${i}" value="${esc(c.name)}" placeholder="Character name">
    <input class="char-role" data-i="${i}" value="${esc(c.role)}" placeholder="Role / age">
    <textarea class="char-look" data-i="${i}" placeholder="Appearance, personality, clothing and voice">${esc(c.look)}</textarea>
    <div class="char-actions"><span class="saved-badge">SAVED CHARACTER</span><button class="secondary use-char" data-i="${i}">＋ Use in Project</button><button class="secondary delete-char" data-i="${i}">🗑 Delete</button></div>
  </div>`;
  box.appendChild(el)
 });
 box.querySelectorAll(".delete-char").forEach(b=>b.onclick=()=>{if(confirm("Delete this saved character?")){characters.splice(+b.dataset.i,1);saveCharacters();renderCharacters()}});
 box.querySelectorAll(".use-char").forEach(b=>b.onclick=()=>insertCharacterIntoStory(characters[+b.dataset.i]));
 box.querySelectorAll(".char-name,.char-role,.char-look").forEach(x=>x.oninput=()=>{characters[+x.dataset.i][x.className.replace("char-","")]=x.value;saveCharacters()});
}
function addCharacter(c={name:"",role:"",look:""}){
 characters.push({...c,id:uid()});saveCharacters();renderCharacters()
}
function insertCharacterIntoStory(c){
 const block=`\n\nCHARACTER: ${c.name}\nROLE: ${c.role}\nLOOK: ${c.look}\n`;
 story.value+=block;updateCount();story.focus()
}
$("#addCharacter").onclick=()=>addCharacter();

$("#sampleBtn").onclick=()=>{story.value=SAMPLE;updateCount();if(!characters.some(x=>x.name==="Elias"))addCharacter({name:"Elias",role:"45-year-old poor fisherman",look:"Weathered face, short dark brown hair, short beard, lean build, worn beige shirt, dark brown trousers, old leather sandals. Kind, humble, hardworking, patient. Warm deep gentle male voice."});if(!characters.some(x=>x.name==="Mara"))addCharacter({name:"Mara",role:"40-year-old fisherman's wife",look:"Long dark brown hair, expressive brown eyes, medium build, simple worn blue dress. Initially loving and grateful, increasingly demanding. Natural expressive female voice."});if(!characters.some(x=>x.name==="Golden Fish"))addCharacter({name:"Golden Fish",role:"Ancient magical talking fish",look:"Magnificent shimmering golden scales, bright glowing eyes, elegant fins, subtle magical golden aura. Wise, mysterious, calm, powerful. Magical calm slightly echoing voice."})};
$("#clearBtn").onclick=()=>{story.value="";updateCount();plan.innerHTML='<div class="empty">Your locked story scenes, dialogue, continuity and GPU shots will appear here.</div>';lastPlan=null;$("#generateBtn").disabled=true};
$("#saveDraft").onclick=()=>{localStorage.setItem("ahm_draft_v4",story.value);$("#statusText").textContent="Draft saved"};
$("#newProject").onclick=()=>{if(confirm("Start a new project? Your saved character library will remain.")){story.value="";updateCount();lastPlan=null;$("#generateBtn").disabled=true;plan.innerHTML='<div class="empty">New project ready.</div>';window.scrollTo({top:0,behavior:"smooth"})}};

function parseScript(text){
 const lines=text.replace(/\r/g,"").split("\n"), scenes=[];let current=null,section="";let title="",style="",constraints=[];
 for(let raw of lines){
  let line=raw.trim();
  if(!line||/^---+$/.test(line))continue;
  if(!current){
   if(/^STYLE\s*:/i.test(line))style=line.replace(/^STYLE\s*:/i,"").trim();
   else if(/^IMPORTANT\s*:/i.test(line))constraints.push(line.replace(/^IMPORTANT\s*:/i,"").trim());
   else if(/^SCENE\s+\d+\s*(?:—|-|:)/i.test(line)){current=newScene(line);scenes.push(current);section="action"}
   continue
  }
  const sm=line.match(/^SCENE\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i);
  if(sm){current=newScene(line);scenes.push(current);section="action";continue}
  let loc=line.match(/^LOCATION\s*:\s*(.*)$/i);if(loc){current.location=loc[1];section="location";continue}
  if(/^ACTION\s*:\s*$/i.test(line)){section="action";continue}
  if(/^DIALOGUE\s*:\s*$/i.test(line)){section="dialogue";continue}
  if(/^CHARACTER(S)?\s*:/i.test(line)){section="characters";current.raw.push(line);continue}
  let d=line.match(/^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*(.*)$/);
  if(d&&!/^(STYLE|IMPORTANT|LOCATION|ACTION|DIALOGUE|CAMERA|AUDIO|SOUND|EMOTION|CONTINUITY|ENVIRONMENT|ROLE|LOOK)$/i.test(d[1])){
    const speaker=d[1].trim(),text=d[2].trim().replace(/^["“]|["”]$/g,"");
    if(text){current.dialogue.push({speaker,text});current.characters.add(speaker)}
    section="dialogue";continue
  }
  if(section==="action")current.action.push(line);
  else if(section==="dialogue"&&current.dialogue.length)current.dialogue[current.dialogue.length-1].text+=" "+line.replace(/^["“]|["”]$/g,"");
  else if(section==="location")current.location+=(current.location?" ":"")+line;
  else current.raw.push(line);
 }
 // remove accidental duplicate scene if malformed numbering is repeated
 const clean=scenes.filter((s,i)=>i===0||s.num!==scenes[i-1].num);
 clean.forEach(s=>{
   characters.forEach(c=>{if(s.action.join(" ").toUpperCase().includes(c.name.toUpperCase()))s.characters.add(c.name.toUpperCase())});
   const text=(s.action.join(" ")+" "+s.dialogue.map(d=>d.text).join(" ")).trim();
   s.shots=makeShots(s,text)
 });
 return {title,style,constraints,scenes:clean}
}
function newScene(line){const m=line.match(/^SCENE\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i);return{num:+m[1],title:m[2].trim(),location:"",action:[],dialogue:[],characters:new Set(),shots:[],raw:[]}}
function makeShots(s,text){
 const words=Math.max(1,text.split(/\s+/).length), count=Math.max(2,Math.min(10,Math.ceil(words/28)));
 const cams=["Wide establishing shot","Medium performance shot","Tracking shot","Over-the-shoulder shot","Emotional close-up","Slow cinematic push-in","Two-shot","Detail insert","Low-angle dramatic shot","Reaction close-up"];
 const actions=s.action.filter(Boolean), shots=[];
 for(let i=0;i<count;i++){
  const source=actions[Math.min(i,Math.max(0,actions.length-1))]||"Perform the supplied story action faithfully.";
  shots.push({id:`${s.num}.${i+1}`,camera:cams[i%cams.length],visual:source})
 }
 return shots
}
function formatTime(sec){sec=Math.max(0,Math.round(sec));return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
function renderPlan(p){
 if(!p.scenes.length){plan.innerHTML='<div class="empty">No valid SCENE headings found. Use “SCENE 1 — Title”.</div>';return}
 const targetSec=+$("#length").value*60;
 const weights=p.scenes.map(s=>Math.max(1,s.action.join(" ").split(/\s+/).length+s.dialogue.map(d=>d.text).join(" ").split(/\s+/).length*1.35));
 const total=weights.reduce((a,b)=>a+b,0);let cursor=0;
 let html=`<div class="plan-meta"><span class="pill">${p.scenes.length} STORY SCENES LOCKED</span><span class="pill">~${formatTime(targetSec)} TARGET</span><span class="pill">${p.scenes.reduce((a,s)=>a+s.shots.length,0)} INTERNAL GPU SHOTS</span><span class="pill">Dialogue locked</span><span class="pill">Continuity locked</span></div>`;
 if(p.style)html+=`<div class="fieldbox"><b>Global visual style</b><p>${esc(p.style)}</p></div>`;
 if(p.constraints.length)html+=`<div class="fieldbox"><b>Global constraints</b><p>${esc(p.constraints.join("\\n"))}</p></div>`;
 p.scenes.forEach(s=>{
  const dur=targetSec*(Math.max(1,s.action.join(" ").split(/\s+/).length+s.dialogue.map(d=>d.text).join(" ").split(/\s+/).length*1.35))/total;
  const start=cursor;cursor+=dur;
  const chars=[...s.characters].join(", ")||"Auto-detect from screenplay";
  const dialogue=s.dialogue.length?s.dialogue.map(d=>`<div class="shot"><b>${esc(d.speaker)}</b><br>${esc(d.text)}</div>`).join(""):"<p>No explicit dialogue.</p>";
  const shots=s.shots.map(x=>`<div class="shot"><b>GPU SHOT ${x.id} · ${esc(x.camera)}</b><br>${esc(x.visual)}</div>`).join("");
  html+=`<article class="scene"><div class="scene-head"><div><div class="scene-title">SCENE ${String(s.num).padStart(2,"0")} · ${esc(s.title)}</div><small>${esc(chars)}</small></div><div class="scene-time">${formatTime(start)} → ${formatTime(cursor)}</div></div><div class="scene-body">
  <div class="fieldbox"><b>Location</b><p>${esc(s.location||"Use the location established by the screenplay.")}</p></div>
  <div class="fieldbox"><b>Characters</b><p>${esc(chars)}</p></div>
  <div class="fieldbox"><b>Action</b><p>${esc(s.action.join("\\n")||"Perform the supplied action faithfully.")}</p></div>
  <div class="fieldbox"><b>Dialogue — locked</b>${dialogue}</div>
  <div class="fieldbox"><b>Internal GPU shot map</b>${shots}</div>
  <div class="fieldbox"><b>Continuity lock</b><p>Use the saved character bible. Preserve face, age, hair, body proportions, wardrobe, voice, props, location and time continuity. Never invent a conflicting event.</p></div>
 </div></article>`
 });
 plan.innerHTML=html
}
$("#buildPlan").onclick=()=>{
 if(!story.value.trim()){alert("Paste a screenplay first.");return}
 lastPlan=parseScript(story.value);renderPlan(lastPlan);
 $("#planSummary").textContent=`${lastPlan.scenes.length} original story scenes locked. ${lastPlan.scenes.reduce((a,s)=>a+s.shots.length,0)} internal production shots prepared.`;
 $("#generateBtn").disabled=!lastPlan.scenes.length;
 $("#statusText").textContent="Plan ready";
 window.scrollTo({top:$("#plan").getBoundingClientRect().top+scrollY-80,behavior:"smooth"})
};

async function generate(){
 if(!lastPlan?.scenes?.length)return;
 $("#generation").classList.remove("hidden");const logs=$("#logs"),bar=$("#progressBar"),status=$("#genStatus"),result=$("#result");
 logs.innerHTML="";result.innerHTML="";bar.style.width="0%";status.textContent="Submitting";$("#statusText").textContent="Generating";
 const settings=loadSettings();
 const payload={project:{script:story.value,characters,style:$("#visualStyle").value,format:$("#format").value,targetMinutes:+$("#length").value,voiceMode:$("#voiceMode").value,noNarrator:$("#noNarrator").checked,subtitles:$("#subtitles").checked},plan:lastPlan};
 try{
   const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||"Generation request failed");
   logs.innerHTML+=`<div>✓ AHM Director package submitted: ${esc(data.projectId||"job")}</div>`;
   if(data.status==="ready"&&data.videoUrl){bar.style.width="100%";status.textContent="Ready";result.innerHTML=`<a class="download" href="${esc(data.videoUrl)}" download>⬇ Download Final MP4</a>`;return}
   const jobId=data.jobId||data.projectId;
   for(let n=1;n<=60;n++){
     await new Promise(res=>setTimeout(res,3000));
     const q=await fetch("/api/generate?jobId="+encodeURIComponent(jobId));
     const d=await q.json();
     if(!q.ok)throw new Error(d.error||"Status check failed");
     bar.style.width=Math.min(99,d.progress||Math.round(n/60*100))+"%";status.textContent=d.status||"Generating";
     logs.innerHTML+=`<div>• ${esc(d.message||"GPU worker processing...")}</div>`;
     if(d.status==="ready"){bar.style.width="100%";result.innerHTML=`<a class="download" href="${esc(d.videoUrl)}" download>⬇ Download Final MP4</a>`;break}
     if(d.status==="error")throw new Error(d.error||"GPU generation failed")
   }
 }catch(e){
   status.textContent="Not connected";$("#statusText").textContent="GPU not connected";
   logs.innerHTML+=`<div>⚠ ${esc(e.message)}</div><div>ℹ The Director plan is ready. Add your server-side GPU credentials/worker before spending money on a generation.</div>`
 }
}
$("#generateBtn").onclick=generate;

$("#settingsBtn").onclick=()=>{$("#settingsModal").classList.remove("hidden");const s=loadSettings();$("#provider").value=s.provider||"runpod";$("#apiKey").value=s.apiKey||"";$("#workerEndpoint").value=s.workerEndpoint||""};
$("#closeSettings").onclick=()=>$("#settingsModal").classList.add("hidden");
$("#saveSettings").onclick=()=>{saveSettings();$("#connectionNote").textContent="Settings saved. For a public deployment, move the secret API key to Vercel Environment Variables before real generation.";$("#settingsModal").classList.add("hidden")};
$("#clearKey").onclick=()=>{$("#apiKey").value="";localStorage.removeItem(SETTINGS_KEY);$("#connectionNote").textContent="Saved connection cleared."};

const draft=localStorage.getItem("ahm_draft_v4");if(draft&&!story.value)story.value=draft;
updateCount();renderCharacters();