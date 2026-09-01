require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PROJECTS = path.join(DATA, 'projects');
const SETTINGS_FILE = path.join(DATA, 'settings.json');
fs.mkdirSync(PROJECTS, { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));

function sendJson(res, status, body) {
  res.status(status).type('application/json').send(JSON.stringify(body));
}
function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function id() { return crypto.randomUUID(); }
function clean(s) { return String(s || '').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'project'; }
function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function parseDuration(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 240; }

function stripQuotes(s) { return String(s || '').trim().replace(/^["“]|["”]$/g, ''); }
function isDialogueLabel(line) {
  return /^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*$/i.test(line) || /^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*["“]/i.test(line);
}
function parseDialogueLine(line) {
  const m = String(line).trim().match(/^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*(.*)$/i);
  if (!m) return null;
  const speaker = m[1].trim().toUpperCase();
  const text = stripQuotes(m[2]);
  if (!text) return { speaker, text: '', pending: true };
  return { speaker, text, pending: false };
}

function parseScreenplay(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const scenes = [];
  const characters = [];
  const global = { style: [], continuity: [], constraints: [], director: [] };
  let scene = null;
  let section = null;
  let pendingSpeaker = null;
  let char = null;

  const finishCharacter = () => {
    if (!char) return;
    const cleanChar = {
      name: char.name,
      role: char.role.trim(), look: char.look.trim(), personality: char.personality.trim(),
      voice: char.voice.trim(), wardrobe: char.wardrobe.trim()
    };
    if (cleanChar.name) characters.push(cleanChar);
    char = null;
  };
  const finishScene = () => {
    if (!scene) return;
    scene.location = scene.location.trim();
    scene.action = scene.action.map(x => x.trim()).filter(Boolean);
    scene.dialogue = scene.dialogue.filter(x => x.text);
    scene.emotion = scene.emotion.map(x => x.trim()).filter(Boolean);
    scene.sound = scene.sound.map(x => x.trim()).filter(Boolean);
    scene.continuity = scene.continuity.map(x => x.trim()).filter(Boolean);
    scenes.push(scene);
    scene = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    const sm = line.match(/^SCENE\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i);
    if (sm) {
      finishCharacter(); finishScene();
      scene = { number: Number(sm[1]), title: sm[2].trim() || `Scene ${sm[1]}`, location: '', action: [], dialogue: [], emotion: [], sound: [], continuity: [] };
      section = null; pendingSpeaker = null; continue;
    }

    if (!scene) {
      const style = line.match(/^STYLE\s*:\s*(.*)$/i);
      if (style) { global.style.push(style[1].trim()); continue; }
      const important = line.match(/^(?:IMPORTANT|CONSTRAINT|RULE)\s*:\s*(.*)$/i);
      if (important) { global.constraints.push(important[1].trim()); continue; }
      const charHead = line.match(/^CHARACTER\s*:\s*(.+)$/i);
      if (charHead) { finishCharacter(); char = { name: charHead[1].trim().toUpperCase(), role:'', look:'', personality:'', voice:'', wardrobe:'' }; section='char'; continue; }
      const director = line.match(/^DIRECTOR INSTRUCTION\s*:\s*(.*)$/i);
      if (director) { global.director.push(director[1].trim()); continue; }
      if (char) {
        const kv = line.match(/^(ROLE|LOOK|PERSONALITY|VOICE|WARDROBE)\s*:\s*(.*)$/i);
        if (kv) { char[kv[1].toLowerCase()] += (char[kv[1].toLowerCase()] ? '\n' : '') + kv[2].trim(); continue; }
      }
      continue;
    }

    const header = line.match(/^(LOCATION|ACTION|DIALOGUE|EMOTION|SOUND|CONTINUITY)\s*:\s*(.*)$/i);
    if (header) {
      section = header[1].toLowerCase(); pendingSpeaker = null;
      if (header[2].trim()) {
        if (section === 'location') scene.location += (scene.location ? ' ' : '') + header[2].trim();
        else if (section === 'action') scene.action.push(header[2].trim());
        else if (section === 'emotion') scene.emotion.push(header[2].trim());
        else if (section === 'sound') scene.sound.push(header[2].trim());
        else if (section === 'continuity') scene.continuity.push(header[2].trim());
      }
      continue;
    }

    if (section === 'dialogue') {
      const d = parseDialogueLine(line);
      if (d) {
        if (d.pending) pendingSpeaker = d.speaker;
        else { scene.dialogue.push({ speaker: d.speaker, text: d.text }); pendingSpeaker = null; }
        continue;
      }
      if (pendingSpeaker) { scene.dialogue.push({ speaker: pendingSpeaker, text: stripQuotes(line) }); pendingSpeaker = null; continue; }
    }

    if (section === 'action') scene.action.push(line);
    else if (section === 'location') scene.location += (scene.location ? ' ' : '') + line;
    else if (section === 'emotion') scene.emotion.push(line);
    else if (section === 'sound') scene.sound.push(line);
    else if (section === 'continuity') scene.continuity.push(line);
    else {
      const d = parseDialogueLine(line);
      if (d && d.text) scene.dialogue.push({ speaker: d.speaker, text: d.text });
      else scene.action.push(line);
    }
  }
  finishCharacter(); finishScene();

  const uniqueChars = new Map();
  for (const c of characters) uniqueChars.set(c.name, c);
  return { scenes, characters: [...uniqueChars.values()], global };
}

function estimateSceneSeconds(scene) {
  const actionWords = words(scene.action.join(' '));
  const dialogueWords = words(scene.dialogue.map(d => d.text).join(' '));
  const seconds = 5 + actionWords * 0.22 + dialogueWords * 0.38;
  return Math.max(12, Math.min(55, Math.round(seconds)));
}

function makeShots(scene) {
  const shots = [];
  if (scene.location) shots.push({ type:'ESTABLISHING', camera:'Wide establishing', visual:scene.location });
  const acts = scene.action.filter(Boolean);
  const maxAction = Math.min(3, acts.length);
  for (let i=0; i<maxAction; i++) {
    const cams = ['Medium action','Tracking / continuation','Detail or reaction'];
    shots.push({ type:'ACTION', camera:cams[i], visual:acts[i] });
  }
  if (scene.dialogue.length) {
    const speakers = [...new Set(scene.dialogue.map(d => d.speaker))];
    shots.push({ type:'DIALOGUE', camera:speakers.length > 1 ? 'Two-shot / alternating close-ups' : 'Performance close-up', visual:'Deliver the exact dialogue below.', dialogue:scene.dialogue });
  }
  if (scene.emotion.length) shots.push({ type:'EMOTION', camera:'Emotional close-up', visual:scene.emotion.join(' ') });
  if (scene.sound.length) shots.push({ type:'SOUND', camera:'Atmospheric coverage', visual:scene.sound.join(' ') });
  return shots.slice(0, 6);
}

function makeEpisodes(scenes, requested, totalSeconds) {
  const count = Math.max(1, Math.min(6, Number(requested) || 6));
  const target = Math.max(25, Math.round(totalSeconds / count));
  const buckets = [];
  let current = [], currentSeconds = 0;
  for (const s of scenes) {
    const duration = estimateSceneSeconds(s);
    if (current.length && currentSeconds + duration > target + Math.min(10, Math.round(target * 0.2)) && buckets.length < count - 1) {
      buckets.push({ scenes: current, duration: currentSeconds }); current = []; currentSeconds = 0;
    }
    current.push({ ...s, duration, shots: makeShots(s) });
    currentSeconds += duration;
  }
  if (current.length) buckets.push({ scenes: current, duration: currentSeconds });
  return buckets.map((b, i) => ({ episode:i+1, title:`Part ${i+1}`, duration:b.duration, scenes:b.scenes }));
}

function buildPlan(input) {
  const screenplay = String(input.screenplay || '').trim();
  if (!screenplay) throw new Error('Paste your screenplay first.');
  const parsed = parseScreenplay(screenplay);
  if (!parsed.scenes.length) throw new Error('No explicit SCENE blocks were found. Use headings like SCENE 1 — TITLE.');
  const targetLength = parseDuration(input.targetLength || 240);
  const episodes = makeEpisodes(parsed.scenes, input.episodes || 6, targetLength);
  const suppliedChars = Array.isArray(input.characters) ? input.characters : [];
  const merged = new Map(parsed.characters.map(c => [c.name, c]));
  for (const c of suppliedChars) if (c && c.name) merged.set(String(c.name).trim().toUpperCase(), { ...c, name:String(c.name).trim().toUpperCase() });
  const dialogueLines = parsed.scenes.reduce((n,s)=>n+s.dialogue.length,0);
  const shotCount = episodes.reduce((n,e)=>n+e.scenes.reduce((m,s)=>m+s.shots.length,0),0);
  return {
    version:'AHM-DIRECTOR-7.1',
    createdAt:new Date().toISOString(),
    visualStyle:input.visualStyle || 'Cinematic Live Action',
    format:input.format || '9:16',
    targetLength,
    subtitles:input.subtitle !== false,
    noNarrator:input.noNarrator !== false,
    global:parsed.global,
    characters:[...merged.values()],
    episodes,
    validation:{ explicitScenes:parsed.scenes.length, dialogueLines, shots:shotCount, requestedEpisodes:Number(input.episodes)||6, actualEpisodes:episodes.length }
  };
}

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`;
}
function makeSrt(episode) {
  let cursor = 0, idx = 1, out = [];
  for (const scene of episode.scenes || []) {
    const lines = scene.dialogue || [];
    if (!lines.length) { cursor += Number(scene.duration)||0; continue; }
    const each = Math.max(1.5, (Number(scene.duration)||5) / lines.length);
    for (const d of lines) {
      const start = cursor, end = cursor + each;
      out.push(`${idx++}\n${srtTime(start)} --> ${srtTime(end)}\n${d.speaker}: ${d.text}\n`);
      cursor = end;
    }
    const sceneEnd = cursor;
    cursor = Math.max(sceneEnd, cursor);
  }
  return out.join('\n');
}

function settings() {
  const s = readJson(SETTINGS_FILE, {});
  return {
    provider:'RunPod',
    mode:s.mode || process.env.WORKER_MODE || 'serverless',
    endpointId:s.endpointId || process.env.RUNPOD_ENDPOINT_ID || '',
    workerUrl:s.workerUrl || process.env.WORKER_URL || '',
    hasApiKey:Boolean(s.apiKey || process.env.RUNPOD_API_KEY)
  };
}
function apiKey() {
  const s = readJson(SETTINGS_FILE, {});
  return s.apiKey || process.env.RUNPOD_API_KEY || '';
}
function requireKey() { if (!apiKey()) throw new Error('RunPod API key is not configured. Open Settings and save it first.'); }

app.get('/api/health', (_,res)=>sendJson(res,200,{ok:true,service:'AHM Studio V7.1',time:new Date().toISOString()}));
app.get('/api/settings', (_,res)=>sendJson(res,200,settings()));
app.post('/api/settings', (req,res)=>{
  try {
    const body=req.body||{}, old=readJson(SETTINGS_FILE,{});
    const next={ mode:body.mode==='direct'?'direct':'serverless', endpointId:String(body.endpointId||old.endpointId||''), workerUrl:String(body.workerUrl||old.workerUrl||'') };
    if (String(body.apiKey||'').trim()) next.apiKey=String(body.apiKey).trim();
    else if (old.apiKey) next.apiKey=old.apiKey;
    if (body.clearApiKey) delete next.apiKey;
    writeJson(SETTINGS_FILE,next);
    sendJson(res,200,{ok:true,...settings()});
  } catch(e) { sendJson(res,500,{ok:false,error:e.message}); }
});

app.post('/api/director/plan',(req,res)=>{ try { sendJson(res,200,buildPlan(req.body||{})); } catch(e) { sendJson(res,400,{ok:false,error:e.message}); } });

app.post('/api/projects',(req,res)=>{
  try { const project={id:id(),createdAt:new Date().toISOString(),...req.body}; writeJson(path.join(PROJECTS,project.id+'.json'),project); sendJson(res,200,project); }
  catch(e){ sendJson(res,500,{ok:false,error:e.message}); }
});
app.get('/api/projects',(req,res)=>{
  try { const list=fs.readdirSync(PROJECTS).filter(x=>x.endsWith('.json')).map(x=>readJson(path.join(PROJECTS,x),{})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); sendJson(res,200,list); }
  catch(e){ sendJson(res,500,{ok:false,error:e.message}); }
});
app.get('/api/projects/:id',(req,res)=>{ const f=path.join(PROJECTS,clean(req.params.id)+'.json'); if(!fs.existsSync(f)) return sendJson(res,404,{ok:false,error:'Project not found'}); sendJson(res,200,readJson(f,{})); });

app.post('/api/subtitles',(req,res)=>{
  try { const ep=req.body?.episode; if(!ep) throw new Error('Episode is required.'); const pid=clean(req.body.projectId||'ahm'); const name=`${pid}-part-${Number(ep.episode)||1}.srt`; const file=path.join(PROJECTS,name); fs.writeFileSync(file,makeSrt(ep)); sendJson(res,200,{ok:true,url:`/files/${encodeURIComponent(name)}`,filename:name}); }
  catch(e){ sendJson(res,400,{ok:false,error:e.message}); }
});
app.use('/files',express.static(PROJECTS,{fallthrough:false}));

function runpodUrl(endpoint, suffix) { return `https://api.runpod.ai/v2/${encodeURIComponent(endpoint)}/${suffix}`; }
async function fetchJson(url, options={}) {
  const response=await fetch(url,options);
  const text=await response.text();
  let data;
  try { data=JSON.parse(text); } catch { throw new Error(`Upstream returned non-JSON (${response.status}): ${text.slice(0,500)}`); }
  if(!response.ok) throw new Error(data.error || data.message || `Upstream request failed (${response.status}).`);
  return data;
}
async function submit(plan) {
  requireKey();
  const s=readJson(SETTINGS_FILE,{}), mode=s.mode || process.env.WORKER_MODE || 'serverless';
  const payload={input:{job_type:'ahm_video_project',director_version:'7.1',project:plan}};
  if(mode==='direct') {
    const url=String(s.workerUrl||process.env.WORKER_URL||'').replace(/\/$/,'');
    if(!url) throw new Error('Direct worker URL is missing.');
    return fetchJson(url,{method:'POST',headers:{Authorization:`Bearer ${apiKey()}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  const endpoint=s.endpointId||process.env.RUNPOD_ENDPOINT_ID;
  if(!endpoint) throw new Error('RunPod endpoint ID is missing.');
  return fetchJson(runpodUrl(endpoint,'run'),{method:'POST',headers:{Authorization:`Bearer ${apiKey()}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
app.post('/api/generate',async(req,res)=>{try{sendJson(res,200,await submit(req.body||{}));}catch(e){sendJson(res,400,{ok:false,error:e.message});}});
app.post('/api/job-status',async(req,res)=>{
  try { requireKey(); const s=readJson(SETTINGS_FILE,{}); const endpoint=s.endpointId||process.env.RUNPOD_ENDPOINT_ID; if(!endpoint) throw new Error('RunPod endpoint ID is missing.'); if(!req.body?.id) throw new Error('Job ID is required.'); const data=await fetchJson(runpodUrl(endpoint,`status/${encodeURIComponent(req.body.id)}`),{headers:{Authorization:`Bearer ${apiKey()}`}}); sendJson(res,200,data); }
  catch(e){ sendJson(res,400,{ok:false,error:e.message}); }
});
app.get('/api/worker-health',async(req,res)=>{
  try { requireKey(); const s=readJson(SETTINGS_FILE,{}); const endpoint=s.endpointId||process.env.RUNPOD_ENDPOINT_ID; if(!endpoint) throw new Error('RunPod endpoint ID is missing.'); sendJson(res,200,await fetchJson(runpodUrl(endpoint,'health'),{headers:{Authorization:`Bearer ${apiKey()}`}})); }
  catch(e){ sendJson(res,400,{ok:false,error:e.message}); }
});

// IMPORTANT: API 404s are JSON, never HTML. This prevents the browser's "Unexpected token < / T" errors.
app.use('/api', (req,res)=>sendJson(res,404,{ok:false,error:`API route not found: ${req.method} ${req.originalUrl}`}));
app.use(express.static(path.join(ROOT,'public')));
app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));

app.use((err,req,res,next)=>{ console.error(err); if(req.path.startsWith('/api')) return sendJson(res,500,{ok:false,error:err.message||'Server error'}); res.status(500).send('AHM Studio server error.'); });

app.listen(PORT,()=>console.log(`AHM Studio V7.1 running on http://localhost:${PORT}`));
