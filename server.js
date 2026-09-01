require("dotenv").config();
const express=require("express");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const app=express();
const PORT=Number(process.env.PORT||10000);
const ROOT=__dirname;
const DATA=path.join(ROOT,"data");
const PROJECTS=path.join(DATA,"projects");

fs.mkdirSync(PROJECTS,{recursive:true});
app.disable("x-powered-by");
app.use(express.json({limit:"20mb"}));

const MAX_SCREENPLAY_BYTES=Number(process.env.MAX_SCREENPLAY_BYTES||200000);
const MAX_PROJECT_BYTES=Number(process.env.MAX_PROJECT_BYTES||2000000);

function sendJson(res,status,body){res.status(status).type("application/json").send(JSON.stringify(body));}
function clean(s){return String(s||"").replace(/[^a-z0-9_-]+/gi,"_").slice(0,80)||"project";}
function words(s){return String(s||"").trim().split(/\s+/).filter(Boolean).length;}
function id(){return crypto.randomUUID();}
function stripQuotes(s){return String(s||"").trim().replace(/^["“]|["”]$/g,"");}
function parseDuration(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n):240;}
function parseDialogueLine(line){
  const m=String(line).trim().match(/^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*(.*)$/i);
  if(!m)return null;
  const speaker=m[1].trim().toUpperCase();
  const text=stripQuotes(m[2]);
  return text?{speaker,text}:{speaker,text:"",pending:true};
}

function parseScreenplay(text){
  if(Buffer.byteLength(String(text||""),"utf8")>MAX_SCREENPLAY_BYTES)throw new Error("Screenplay is too large.");
  const lines=String(text||"").replace(/\r/g,"").split("\n");
  const scenes=[],characters=[],global={style:[],continuity:[],constraints:[],director:[]};
  let scene=null,section=null,pendingSpeaker=null,char=null;

  const finishCharacter=()=>{
    if(!char)return;
    const c={name:char.name,role:char.role.trim(),look:char.look.trim(),personality:char.personality.trim(),voice:char.voice.trim(),wardrobe:char.wardrobe.trim()};
    if(c.name)characters.push(c);char=null;
  };
  const finishScene=()=>{
    if(!scene)return;
    scene.location=scene.location.trim();
    scene.action=scene.action.map(x=>x.trim()).filter(Boolean);
    scene.dialogue=scene.dialogue.filter(x=>x.text);
    scene.emotion=scene.emotion.map(x=>x.trim()).filter(Boolean);
    scene.sound=scene.sound.map(x=>x.trim()).filter(Boolean);
    scene.continuity=scene.continuity.map(x=>x.trim()).filter(Boolean);
    scenes.push(scene);scene=null;
  };

  for(const raw of lines){
    const line=raw.trim();if(!line)continue;
    const sm=line.match(/^SCENE\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i);
    if(sm){finishCharacter();finishScene();scene={number:Number(sm[1]),title:sm[2].trim()||`Scene ${sm[1]}`,location:"",action:[],dialogue:[],emotion:[],sound:[],continuity:[]};section=null;pendingSpeaker=null;continue;}

    if(!scene){
      let m=line.match(/^STYLE\s*:\s*(.*)$/i);if(m){global.style.push(m[1].trim());continue;}
      m=line.match(/^(?:IMPORTANT|CONSTRAINT|RULE)\s*:\s*(.*)$/i);if(m){global.constraints.push(m[1].trim());continue;}
      m=line.match(/^CHARACTER\s*:\s*(.+)$/i);if(m){finishCharacter();char={name:m[1].trim().toUpperCase(),role:"",look:"",personality:"",voice:"",wardrobe:""};continue;}
      m=line.match(/^DIRECTOR INSTRUCTION\s*:\s*(.*)$/i);if(m){global.director.push(m[1].trim());continue;}
      if(char){
        const kv=line.match(/^(ROLE|LOOK|PERSONALITY|VOICE|WARDROBE)\s*:\s*(.*)$/i);
        if(kv){const k=kv[1].toLowerCase();char[k]+=(char[k]?"\n":"")+kv[2].trim();continue;}
      }
      continue;
    }

    const header=line.match(/^(LOCATION|ACTION|DIALOGUE|EMOTION|SOUND|CONTINUITY)\s*:\s*(.*)$/i);
    if(header){
      section=header[1].toLowerCase();pendingSpeaker=null;
      const value=header[2].trim();
      if(value){
        if(section==="location")scene.location+=(scene.location?" ":"")+value;
        else scene[section].push(value);
      }
      continue;
    }

    if(section==="dialogue"){
      const d=parseDialogueLine(line);
      if(d){if(d.pending)pendingSpeaker=d.speaker;else{scene.dialogue.push({speaker:d.speaker,text:d.text});pendingSpeaker=null;}continue;}
      if(pendingSpeaker){scene.dialogue.push({speaker:pendingSpeaker,text:stripQuotes(line)});pendingSpeaker=null;continue;}
    }

    if(section==="action")scene.action.push(line);
    else if(section==="location")scene.location+=(scene.location?" ":"")+line;
    else if(section==="emotion")scene.emotion.push(line);
    else if(section==="sound")scene.sound.push(line);
    else if(section==="continuity")scene.continuity.push(line);
    else{
      const d=parseDialogueLine(line);
      if(d&&d.text)scene.dialogue.push({speaker:d.speaker,text:d.text});
      else scene.action.push(line);
    }
  }
  finishCharacter();finishScene();
  const unique=new Map();for(const c of characters)unique.set(c.name,c);
  return {scenes,characters:[...unique.values()],global};
}

function estimateSceneSeconds(scene){
  const a=words(scene.action.join(" ")),d=words(scene.dialogue.map(x=>x.text).join(" "));
  return Math.max(12,Math.min(55,Math.round(5+a*.22+d*.38)));
}

function makeShots(scene){
  const shots=[];
  if(scene.location)shots.push({type:"ESTABLISHING",camera:"Wide establishing",visual:scene.location});
  const acts=scene.action.filter(Boolean);
  const cams=["Medium action","Tracking / continuation","Detail or reaction"];
  acts.slice(0,3).forEach((a,i)=>shots.push({type:"ACTION",camera:cams[i],visual:a}));
  if(scene.dialogue.length){
    const speakers=[...new Set(scene.dialogue.map(d=>d.speaker))];
    shots.push({type:"DIALOGUE",camera:speakers.length>1?"Two-shot / alternating close-ups":"Performance close-up",visual:"Deliver the exact locked dialogue.",dialogue:scene.dialogue});
  }
  if(scene.emotion.length)shots.push({type:"EMOTION",camera:"Emotional close-up",visual:scene.emotion.join(" ")});
  if(scene.sound.length)shots.push({type:"SOUND",camera:"Atmospheric coverage",visual:scene.sound.join(" ")});
  return shots.slice(0,6);
}

function makeEpisodes(scenes,requested,totalSeconds){
  const count=Math.max(1,Math.min(6,Number(requested)||6));
  const target=Math.max(25,Math.round(totalSeconds/count));
  const buckets=[];let current=[],seconds=0;
  for(const raw of scenes){
    const s={...raw,duration:estimateSceneSeconds(raw),shots:makeShots(raw)};
    if(current.length&&seconds+s.duration>target+Math.min(10,Math.round(target*.2))&&buckets.length<count-1){
      buckets.push({scenes:current,duration:seconds});current=[];seconds=0;
    }
    current.push(s);seconds+=s.duration;
  }
  if(current.length)buckets.push({scenes:current,duration:seconds});
  return buckets.map((b,i)=>({episode:i+1,title:`Part ${i+1}`,duration:b.duration,scenes:b.scenes}));
}

function buildPlan(input){
  const screenplay=String(input.screenplay||"").trim();
  if(!screenplay)throw new Error("Paste your screenplay first.");
  const parsed=parseScreenplay(screenplay);
  if(!parsed.scenes.length)throw new Error("No explicit SCENE blocks were found. Use headings like SCENE 1 — TITLE.");
  const targetLength=parseDuration(input.targetLength);
  const episodes=makeEpisodes(parsed.scenes,input.episodes,targetLength);
  const merged=new Map(parsed.characters.map(c=>[c.name,c]));
  for(const c of Array.isArray(input.characters)?input.characters:[]){
    if(c&&c.name)merged.set(String(c.name).trim().toUpperCase(),{...c,name:String(c.name).trim().toUpperCase()});
  }
  const dialogueLines=parsed.scenes.reduce((n,s)=>n+s.dialogue.length,0);
  const shotCount=episodes.reduce((n,e)=>n+e.scenes.reduce((m,s)=>m+s.shots.length,0),0);
  return {
    version:"AHM-DIRECTOR-8.0",
    createdAt:new Date().toISOString(),
    visualStyle:input.visualStyle||"Cinematic Live Action",
    format:input.format||"9:16",
    targetLength,
    subtitles:input.subtitle!==false,
    noNarrator:input.noNarrator!==false,
    global:parsed.global,
    characters:[...merged.values()],
    episodes,
    validation:{explicitScenes:parsed.scenes.length,dialogueLines,shots:shotCount,requestedEpisodes:Number(input.episodes)||6,actualEpisodes:episodes.length}
  };
}

function settings(){
  return {
    environment:process.env.RENDER?"Render":"Local",
    hasApiKey:Boolean(process.env.RUNPOD_API_KEY),
    hasEndpoint:Boolean(process.env.RUNPOD_ENDPOINT_ID),
    workerMode:process.env.AHM_WORKER_MODE||"demo"
  };
}
function requireRunPod(){
  if(!process.env.RUNPOD_API_KEY)throw new Error("RUNPOD_API_KEY is not configured on the server.");
  if(!process.env.RUNPOD_ENDPOINT_ID)throw new Error("RUNPOD_ENDPOINT_ID is not configured on the server.");
}
function runpodUrl(suffix){return `https://api.runpod.ai/v2/${encodeURIComponent(process.env.RUNPOD_ENDPOINT_ID)}/${suffix}`;}
async function fetchJson(url,options={}){
  const r=await fetch(url,options),text=await r.text();let d;
  try{d=JSON.parse(text)}catch{throw new Error(`RunPod returned non-JSON (${r.status}): ${text.slice(0,300)}`);}
  if(!r.ok)throw new Error(d.error||d.message||`RunPod request failed (${r.status}).`);
  return d;
}
async function submit(plan){
  requireRunPod();
  const payload={input:{job_type:"ahm_video_project",director_version:"8.0",project:plan}};
  return fetchJson(runpodUrl("run"),{method:"POST",headers:{Authorization:`Bearer ${process.env.RUNPOD_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
}

app.get("/api/health",(_,res)=>sendJson(res,200,{ok:true,service:"AHM Studio V8",time:new Date().toISOString(),runpodConfigured:Boolean(process.env.RUNPOD_API_KEY&&process.env.RUNPOD_ENDPOINT_ID)}));
app.get("/api/settings",(_,res)=>sendJson(res,200,settings()));

app.post("/api/director/plan",(req,res)=>{
  try{sendJson(res,200,buildPlan(req.body||{}));}
  catch(e){sendJson(res,400,{ok:false,error:e.message});}
});

app.post("/api/projects",(req,res)=>{
  try{
    const body=JSON.stringify(req.body||{});
    if(Buffer.byteLength(body,"utf8")>MAX_PROJECT_BYTES)throw new Error("Project is too large.");
    const project={id:id(),createdAt:new Date().toISOString(),...req.body};
    fs.writeFileSync(path.join(PROJECTS,project.id+".json"),JSON.stringify(project,null,2));
    sendJson(res,200,project);
  }catch(e){sendJson(res,500,{ok:false,error:e.message});}
});

app.get("/api/projects",(req,res)=>{
  try{
    const list=fs.readdirSync(PROJECTS).filter(x=>x.endsWith(".json")).map(x=>{try{return JSON.parse(fs.readFileSync(path.join(PROJECTS,x),"utf8"))}catch{return null}}).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res,200,list);
  }catch(e){sendJson(res,500,{ok:false,error:e.message});}
});

app.get("/api/projects/:id",(req,res)=>{
  const file=path.join(PROJECTS,clean(req.params.id)+".json");
  if(!fs.existsSync(file))return sendJson(res,404,{ok:false,error:"Project not found"});
  sendJson(res,200,JSON.parse(fs.readFileSync(file,"utf8")));
});

function srtTime(sec){
  const ms=Math.max(0,Math.round(sec*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
}
function makeSrt(episode){
  let cursor=0,idx=1,out=[];
  for(const scene of episode.scenes||[]){
    const lines=scene.dialogue||[];
    if(!lines.length){cursor+=Number(scene.duration)||0;continue;}
    const each=Math.max(1.5,(Number(scene.duration)||5)/lines.length);
    for(const d of lines){
      const start=cursor,end=cursor+each;
      out.push(`${idx++}\n${srtTime(start)} --> ${srtTime(end)}\n${d.speaker}: ${d.text}\n`);
      cursor=end;
    }
  }
  return out.join("\n");
}

app.post("/api/subtitles",(req,res)=>{
  try{
    const ep=req.body?.episode;if(!ep)throw new Error("Episode is required.");
    const pid=clean(req.body.projectId||"ahm"),name=`${pid}-part-${Number(ep.episode)||1}.srt`;
    fs.writeFileSync(path.join(PROJECTS,name),makeSrt(ep));
    sendJson(res,200,{ok:true,url:`/files/${encodeURIComponent(name)}`,filename:name});
  }catch(e){sendJson(res,400,{ok:false,error:e.message});}
});
app.use("/files",express.static(PROJECTS,{fallthrough:false}));

app.post("/api/generate",async(req,res)=>{
  try{
    if(!req.body?.plan)throw new Error("Director plan is required.");
    sendJson(res,200,await submit(req.body.plan));
  }catch(e){sendJson(res,400,{ok:false,error:e.message});}
});

app.post("/api/job-status",async(req,res)=>{
  try{
    requireRunPod();
    if(!req.body?.id)throw new Error("Job ID is required.");
    sendJson(res,200,await fetchJson(runpodUrl(`status/${encodeURIComponent(req.body.id)}`),{headers:{Authorization:`Bearer ${process.env.RUNPOD_API_KEY}`}}));
  }catch(e){sendJson(res,400,{ok:false,error:e.message});}
});

app.get("/api/worker-health",async(req,res)=>{
  try{requireRunPod();sendJson(res,200,await fetchJson(runpodUrl("health"),{headers:{Authorization:`Bearer ${process.env.RUNPOD_API_KEY}`}}));}
  catch(e){sendJson(res,400,{ok:false,error:e.message});}
});

app.use("/api",(req,res)=>sendJson(res,404,{ok:false,error:`API route not found: ${req.method} ${req.originalUrl}`}));
app.use(express.static(path.join(ROOT,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(ROOT,"public","index.html")));
app.use((err,req,res,next)=>{console.error(err);if(req.path.startsWith("/api"))return sendJson(res,500,{ok:false,error:err.message||"Server error"});res.status(500).send("AHM Studio server error.");});

app.listen(PORT,"0.0.0.0",()=>console.log(`AHM Studio V8 running on port ${PORT}`));
