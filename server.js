require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const SETTINGS = path.join(DATA, 'settings.json');
const PROJECTS = path.join(DATA, 'projects');
fs.mkdirSync(DATA,{recursive:true}); fs.mkdirSync(PROJECTS,{recursive:true});
app.use(express.json({limit:'15mb'}));
app.use(express.static(path.join(ROOT,'public')));

function readJson(file, fallback){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function writeJson(file,obj){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(obj,null,2)); }
function cleanName(s){ return String(s||'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,80)||'project'; }
function parseScreenplay(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  const scenes=[]; let cur=null; let section=null;
  const push=()=>{if(cur){cur.location=cur.location.trim();cur.action=cur.action.trim();cur.dialogue=cur.dialogue.trim();cur.emotion=cur.emotion.trim();cur.sound=cur.sound.trim();scenes.push(cur);} };
  for(let raw of lines){
    const line=raw.trim(); if(!line) continue;
    const sm=line.match(/^SCENE\s+(\d+)\s*[—-]\s*(.+)$/i);
    if(sm){push();cur={number:Number(sm[1]),title:sm[2].trim(),location:'',action:'',dialogue:'',emotion:'',sound:''};section=null;continue;}
    const hdr=line.match(/^(LOCATION|ACTION|DIALOGUE|EMOTION|SOUND|CONTINUITY|CAMERA|VISUAL STYLE|STYLE|CHARACTERS)\s*:?$/i);
    if(hdr){section=hdr[1].toLowerCase(); if(section==='continuity'||section==='camera'||section==='characters') section=null; continue;}
    if(cur && section){
      if(section==='location') cur.location+=(cur.location?'\n':'')+line;
      else if(section==='action') cur.action+=(cur.action?'\n':'')+line;
      else if(section==='dialogue') cur.dialogue+=(cur.dialogue?'\n':'')+line;
      else if(section==='emotion') cur.emotion+=(cur.emotion?'\n':'')+line;
      else if(section==='sound') cur.sound+=(cur.sound?'\n':'')+line;
    } else if(cur && /^(?:[A-Z][A-Z0-9 _-]{1,30}):\s*"/.test(line)) {
      cur.dialogue+=(cur.dialogue?'\n':'')+line;
    }
  }
  push();
  // Fallback: split only on explicit scene headings; do not invent scenes.
  return scenes;
}
function dialogueLines(block){
  return String(block||'').split('\n').map(x=>x.trim()).filter(x=>/^[A-Z][A-Z0-9 _-]{1,30}:\s*".*"$/.test(x));
}
function estimateSceneSeconds(s){
  const words=(s.action+' '+s.dialogue).split(/\s+/).filter(Boolean).length;
  const d=dialogueLines(s.dialogue).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(28, Math.round(5 + words*0.18 + d*0.16)));
}
function makeShots(s){
  const shots=[];
  if(s.location) shots.push({type:'ESTABLISHING',prompt:`${s.location}. Establish the exact geography before the action begins.`});
  const acts=s.action.split(/\n+/).map(x=>x.replace(/^[-•*]\s*/,'').trim()).filter(Boolean);
  acts.forEach((a,i)=>shots.push({type:i===0?'ACTION':'CONTINUATION',prompt:a}));
  const ds=dialogueLines(s.dialogue);
  ds.forEach(d=>shots.push({type:'DIALOGUE',prompt:d}));
  if(s.emotion) shots.push({type:'EMOTION',prompt:s.emotion});
  // Keep production coverage compact; dialogue is attached to the scene, not forced into 1-shot-per-line.
  return shots.slice(0,12);
}
function buildPlan({screenplay,characters=[],episodes=6,visualStyle='Cinematic Live Action',format='9:16',targetLength=240,subtitle=true}){
  const scenes=parseScreenplay(screenplay);
  if(!scenes.length) throw new Error('No explicit SCENE blocks were found.');
  const total=targetLength||240; const targetEp=Math.max(30,Math.round(total/episodes));
  let episodeNo=1, ep=[], epSec=0; const eps=[];
  for(const s of scenes){
    const sec=estimateSceneSeconds(s);
    if(ep.length && epSec+sec>targetEp+8 && episodeNo<episodes){ eps.push({episode:episodeNo,duration:epSec,scenes:ep}); episodeNo++; ep=[]; epSec=0; }
    ep.push({...s,duration:sec,shots:makeShots(s)}); epSec+=sec;
  }
  if(ep.length) eps.push({episode:episodeNo,duration:epSec,scenes:ep});
  // Re-label sequentially and distribute empty requested episodes only if possible without inventing story content.
  const episodeData=eps.map((e,i)=>({episode:i+1,title:`Part ${i+1}`,duration:e.duration,scenes:e.scenes}));
  return {version:'AHM-DIRECTOR-7',visualStyle,format,targetLength:total,subtitles:subtitle,episodes:episodeData,characters,validation:{explicitScenes:scenes.length,dialogueLines:scenes.reduce((n,s)=>n+dialogueLines(s.dialogue).length,0),shots:episodeData.reduce((n,e)=>n+e.scenes.reduce((m,s)=>m+s.shots.length,0),0)}};
}
function srtForEpisode(ep){
  let t=0, out=[], idx=1;
  for(const s of ep.scenes){
    const ds=dialogueLines(s.dialogue); if(!ds.length){t+=s.duration;continue;}
    const per=Math.max(2, s.duration/ds.length);
    ds.forEach(d=>{const start=t; const end=Math.min(t+per,t+s.duration); const m=x=>{x=Math.max(0,x);const h=Math.floor(x/3600),mi=Math.floor((x%3600)/60),se=Math.floor(x%60),ms=Math.floor((x%1)*1000);return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(se).padStart(2,'0')},${String(ms).padStart(3,'0')}`}; out.push(`${idx++}\n${m(start)} --> ${m(end)}\n${d}\n`); t=end;});
  }
  return out.join('\n');
}
function getSettings(){
  const s=readJson(SETTINGS,{}); return {provider:s.provider||'RunPod Serverless',endpointId:s.endpointId||process.env.RUNPOD_ENDPOINT_ID||'',workerUrl:s.workerUrl||process.env.WORKER_URL||'',hasApiKey:!!(s.apiKey||process.env.RUNPOD_API_KEY),mode:s.mode||process.env.WORKER_MODE||'serverless'};
}
app.get('/api/settings',(_,res)=>res.json(getSettings()));
app.post('/api/settings',(req,res)=>{
  const body=req.body||{}; const existing=readJson(SETTINGS,{});
  // API key is never returned by this API.
  const next={provider:body.provider||existing.provider||'RunPod Serverless',endpointId:String(body.endpointId||existing.endpointId||''),workerUrl:String(body.workerUrl||existing.workerUrl||''),mode:body.mode||existing.mode||'serverless'};
  if(body.apiKey && String(body.apiKey).trim()) next.apiKey=String(body.apiKey).trim();
  if(body.clearApiKey) delete next.apiKey;
  writeJson(SETTINGS,next); res.json(getSettings());
});
app.post('/api/director/plan',(req,res)=>{try{const p=buildPlan(req.body);res.json(p);}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/projects',(req,res)=>{try{const id=uuidv4();const project={id,createdAt:new Date().toISOString(),...req.body};writeJson(path.join(PROJECTS,id+'.json'),project);res.json(project);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/projects',(req,res)=>{const files=fs.readdirSync(PROJECTS).filter(f=>f.endsWith('.json'));res.json(files.map(f=>readJson(path.join(PROJECTS,f),{})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));});
app.get('/api/projects/:id',(req,res)=>{const f=path.join(PROJECTS,req.params.id+'.json');if(!fs.existsSync(f))return res.status(404).json({error:'Not found'});res.json(readJson(f,{}));});
app.post('/api/subtitles',(req,res)=>{try{const ep=req.body.episode; if(!ep) throw Error('Episode required'); const file=path.join(DATA,'projects',`${cleanName(req.body.projectId||'project')}-part-${ep.episode}.srt`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,srtForEpisode(ep));res.json({url:`/files/${path.basename(file)}`});}catch(e){res.status(400).json({error:e.message});}});
app.use('/files',express.static(path.join(DATA,'projects')));
function authHeaders(){const s=readJson(SETTINGS,{});const key=s.apiKey||process.env.RUNPOD_API_KEY;if(!key)throw Error('RunPod API key is not configured.');return {'Authorization':`Bearer ${key}`,'Content-Type':'application/json'};}
async function runWorker(plan){
  const s=readJson(SETTINGS,{}); const mode=s.mode||process.env.WORKER_MODE||'serverless';
  const endpoint=s.endpointId||process.env.RUNPOD_ENDPOINT_ID; const url=s.workerUrl||process.env.WORKER_URL;
  let target;
  if(mode==='serverless') {if(!endpoint)throw Error('RunPod endpoint ID is missing.');target=`https://api.runpod.ai/v2/${endpoint}/run`;}
  else {if(!url)throw Error('Worker URL is missing.');target=url.replace(/\/$/,'')+'/run';}
  const r=await fetch(target,{method:'POST',headers:authHeaders(),body:JSON.stringify({input:{job_type:'ahm_video_project',director_version:'7',project:plan}})});
  const txt=await r.text(); let data; try{data=JSON.parse(txt)}catch{data={raw:txt}}; if(!r.ok)throw Error(`Worker request failed (${r.status}): ${txt.slice(0,500)}`); return data;
}
app.post('/api/generate',(req,res)=>{runWorker(req.body).then(data=>res.json(data)).catch(e=>res.status(400).json({error:e.message}));});
app.post('/api/job-status',async(req,res)=>{try{const s=readJson(SETTINGS,{}),key=s.apiKey||process.env.RUNPOD_API_KEY;if(!key)throw Error('RunPod API key is not configured.');const endpoint=s.endpointId||process.env.RUNPOD_ENDPOINT_ID;if(!endpoint)throw Error('Endpoint ID missing.');const r=await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${encodeURIComponent(req.body.id)}`,{headers:{Authorization:`Bearer ${key}`}});const txt=await r.text();let d;try{d=JSON.parse(txt)}catch{d={raw:txt}};res.status(r.status).json(d);}catch(e){res.status(400).json({error:e.message});}});
app.listen(PORT,()=>console.log(`AHM Studio V7 running on http://localhost:${PORT}`));
