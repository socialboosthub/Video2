require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');

const DIRECTOR_VERSION = '8.2';
const MAX_BODY = '25mb';
const MAX_SCREENPLAY_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_BYTES = 8 * 1024 * 1024;

const ALLOWED_FORMATS = new Set(['9:16', '16:9', '1:1']);

fs.mkdirSync(PROJECTS_DIR, { recursive: true });
fs.mkdirSync(JOBS_DIR, { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: MAX_BODY }));

function json(res, status, body) {
  return res
    .status(status)
    .type('application/json')
    .send(JSON.stringify(body));
}

function makeId(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

function text(v) {
  return String(v == null ? '' : v).trim();
}

function cleanText(v) {
  return text(v).replace(/[ \t]+/g, ' ').trim();
}

function wordCount(v) {
  const s = cleanText(v);
  return s ? s.split(/\s+/).length : 0;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function safeProjectId(v) {
  const s = text(v)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 100);

  return s || 'project';
}

function stripOuterQuotes(v) {
  let s = text(v);

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith('“') && s.endsWith('”')) ||
    (s.startsWith('‘') && s.endsWith('’'))
  ) {
    s = s.slice(1, -1).trim();
  }

  return s;
}

const STRUCTURAL_LABELS = new Set([
  'STYLE',
  'IMPORTANT',
  'CONSTRAINT',
  'CONSTRAINTS',
  'RULE',
  'RULES',
  'LOCATION',
  'ACTION',
  'DIALOGUE',
  'EMOTION',
  'SOUND',
  'CONTINUITY',
  'CAMERA',
  'AUDIO',
  'ENVIRONMENT',
  'ROLE',
  'LOOK',
  'PERSONALITY',
  'VOICE',
  'WARDROBE',
  'CHARACTER',
  'CHARACTERS',
  'DIRECTOR INSTRUCTION',
  'VISUAL STYLE',
  'FORMAT',
  'SUBTITLES',
  'NARRATOR'
]);

function normalizeSpeaker(v) {
  return cleanText(v)
    .replace(/^['"“”]+|['"“”]+$/g, '')
    .toUpperCase();
}

function parseSpeakerLine(line) {
  const m = text(line).match(
    /^([A-Z][A-Z0-9 _'&.-]{0,60})\s*:\s*(.*)$/i
  );

  if (!m) return null;

  const speaker = normalizeSpeaker(m[1]);

  if (!speaker || STRUCTURAL_LABELS.has(speaker)) {
    return null;
  }

  return {
    speaker,
    value: stripOuterQuotes(m[2])
  };
}

function parseSceneHeading(line) {
  const m = text(line).match(
    /^SCENE\s+(\d+)\s*(?:—|–|-|:)\s*(.*)$/i
  );

  if (!m) return null;

  return {
    number: Number(m[1]),
    title: cleanText(m[2]) || `Scene ${m[1]}`
  };
}

function parseHeader(line) {
  const m = text(line).match(
    /^(LOCATION|ACTION|DIALOGUE|EMOTION|SOUND|CONTINUITY)\s*:\s*(.*)$/i
  );

  if (!m) return null;

  return {
    name: m[1].toLowerCase(),
    value: cleanText(m[2])
  };
}

function addSceneLine(scene, section, line, pendingSpeaker) {
  const value = cleanText(line);

  if (!value) {
    return { pendingSpeaker };
  }

  if (section === 'dialogue') {
    const speakerLine = parseSpeakerLine(value);

    if (speakerLine) {
      if (speakerLine.value) {
        scene.dialogue.push({
          speaker: speakerLine.speaker,
          text: speakerLine.value
        });

        return {
          pendingSpeaker: null
        };
      }

      return {
        pendingSpeaker: speakerLine.speaker
      };
    }

    if (pendingSpeaker) {
      scene.dialogue.push({
        speaker: pendingSpeaker,
        text: stripOuterQuotes(value)
      });

      return {
        pendingSpeaker: null
      };
    }

    scene.action.push(value);

    return {
      pendingSpeaker: null
    };
  }

  const speakerLine = parseSpeakerLine(value);

  if (speakerLine) {
    if (speakerLine.value) {
      scene.dialogue.push({
        speaker: speakerLine.speaker,
        text: speakerLine.value
      });

      return {
        pendingSpeaker: null
      };
    }

    return {
      pendingSpeaker: speakerLine.speaker
    };
  }

  if (section === 'location') {
    scene.location = cleanText(
      `${scene.location} ${value}`
    );
  } else if (section === 'action') {
    scene.action.push(value);
  } else if (section === 'emotion') {
    scene.emotion.push(value);
  } else if (section === 'sound') {
    scene.sound.push(value);
  } else if (section === 'continuity') {
    scene.continuity.push(value);
  } else {
    scene.action.push(value);
  }

  return {
    pendingSpeaker: null
  };
}

function escapeRegExp(v) {
  return String(v).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function parseScreenplay(screenplay) {
  const source = String(screenplay || '').replace(/\r/g, '');
  const lines = source.split('\n');

  const scenes = [];
  const characters = [];

  const global = {
    style: [],
    constraints: [],
    director: [],
    continuity: []
  };

  let scene = null;
  let section = '';
  let pendingSpeaker = null;

  let character = null;
  let characterSection = '';

  function finishCharacter() {
    if (!character) return;

    const c = {
      name: normalizeSpeaker(character.name),
      role: cleanText(character.role),
      look: cleanText(character.look),
      personality: cleanText(character.personality),
      voice: cleanText(character.voice),
      wardrobe: cleanText(character.wardrobe)
    };

    if (c.name) {
      characters.push(c);
    }

    character = null;
    characterSection = '';
  }

  function finishScene() {
    if (!scene) return;

    pendingSpeaker = null;

    scene.location = cleanText(scene.location);

    scene.action = scene.action
      .map(cleanText)
      .filter(Boolean);

    scene.dialogue = scene.dialogue
      .map(d => ({
        speaker: normalizeSpeaker(d.speaker),
        text: stripOuterQuotes(d.text)
      }))
      .filter(d => d.speaker && d.text);

    scene.emotion = scene.emotion
      .map(cleanText)
      .filter(Boolean);

    scene.sound = scene.sound
      .map(cleanText)
      .filter(Boolean);

    scene.continuity = scene.continuity
      .map(cleanText)
      .filter(Boolean);

    scene.characters = [
      ...new Set([
        ...scene.dialogue.map(d => d.speaker),

        ...scene.action.flatMap(action =>
          characters
            .map(c => c.name)
            .filter(name =>
              new RegExp(
                `\\b${escapeRegExp(name)}\\b`,
                'i'
              ).test(action)
            )
        )
      ])
    ];

    scenes.push(scene);

    scene = null;
    section = '';
    pendingSpeaker = null;
  }

  for (const raw of lines) {
    const line = text(raw);

    const heading = parseSceneHeading(line);

    if (heading) {
      finishCharacter();
      finishScene();

      scene = {
        number: heading.number,
        title: heading.title,
        location: '',
        action: [],
        dialogue: [],
        emotion: [],
        sound: [],
        continuity: [],
        characters: [],
        shots: []
      };

      section = 'action';
      pendingSpeaker = null;

      continue;
    }

    /*
      IMPORTANT:
      Blank lines do NOT reset the dialogue section.
      This prevents dialogue from disappearing when a screenplay
      contains blank lines between speaker lines.
    */
    if (!line || /^---+$/.test(line)) {
      continue;
    }

    if (!scene) {
      const style = line.match(
        /^STYLE\s*:\s*(.*)$/i
      );

      if (style) {
        global.style.push(cleanText(style[1]));
        continue;
      }

      const important = line.match(
        /^(IMPORTANT|CONSTRAINTS?|RULES?)\s*:\s*(.*)$/i
      );

      if (important) {
        global.constraints.push(
          cleanText(important[2])
        );

        continue;
      }

      const director = line.match(
        /^DIRECTOR(?:\s+INSTRUCTION)?\s*:\s*(.*)$/i
      );

      if (director) {
        global.director.push(
          cleanText(director[1])
        );

        continue;
      }

      const charHead = line.match(
        /^CHARACTER\s*:\s*(.+)$/i
      );

      if (charHead) {
        finishCharacter();

        character = {
          name: charHead[1],
          role: '',
          look: '',
          personality: '',
          voice: '',
          wardrobe: ''
        };

        characterSection = '';

        continue;
      }

      if (character) {
        const kv = line.match(
          /^(ROLE|LOOK|PERSONALITY|VOICE|WARDROBE)\s*:\s*(.*)$/i
        );

        if (kv) {
          characterSection =
            kv[1].toLowerCase();

          character[characterSection] =
            cleanText(
              `${character[characterSection]} ${kv[2]}`
            );

          continue;
        }

        if (characterSection) {
          character[characterSection] =
            cleanText(
              `${character[characterSection]} ${line}`
            );

          continue;
        }
      }

      continue;
    }

    const header = parseHeader(line);

    if (header) {
      section = header.name;
      pendingSpeaker = null;

      if (header.value) {
        const result = addSceneLine(
          scene,
          section,
          header.value,
          pendingSpeaker
        );

        pendingSpeaker = result.pendingSpeaker;
      }

      continue;
    }

    const result = addSceneLine(
      scene,
      section,
      line,
      pendingSpeaker
    );

    pendingSpeaker = result.pendingSpeaker;
  }

  finishCharacter();
  finishScene();

  const charMap = new Map();

  for (const c of characters) {
    const old = charMap.get(c.name);

    if (!old) {
      charMap.set(c.name, c);
    } else {
      for (const key of [
        'role',
        'look',
        'personality',
        'voice',
        'wardrobe'
      ]) {
        if (!old[key] && c[key]) {
          old[key] = c[key];
        }
      }
    }
  }

  return {
    scenes,
    characters: [...charMap.values()],
    global
  };
}

function allocateExact(total, rawValues, min = 1) {
  const target = Math.max(
    rawValues.length,
    Math.round(Number(total) || 0)
  );

  const values = rawValues.map(v =>
    Math.max(0.01, Number(v) || 0.01)
  );

  const sum = values.reduce(
    (a, b) => a + b,
    0
  );

  const exact = values.map(
    v => (v / sum) * target
  );

  const out = exact.map(v =>
    Math.max(min, Math.floor(v))
  );

  let current = out.reduce(
    (a, b) => a + b,
    0
  );

  const order = exact
    .map((v, i) => ({
      i,
      frac: v - Math.floor(v)
    }))
    .sort((a, b) => b.frac - a.frac);

  let p = 0;

  while (current < target && order.length) {
    out[order[p % order.length].i]++;
    current++;
    p++;
  }

  while (current > target) {
    let idx = -1;

    for (let i = 0; i < out.length; i++) {
      if (out[i] > min) {
        if (
          idx === -1 ||
          out[i] > out[idx]
        ) {
          idx = i;
        }
      }
    }

    if (idx === -1) break;

    out[idx]--;
    current--;
  }

  return out;
}

function estimateSceneSeconds(scene) {
  const actionWords = wordCount(
    scene.action.join(' ')
  );

  const dialogueWords = wordCount(
    scene.dialogue
      .map(d => d.text)
      .join(' ')
  );

  const base =
    5 +
    actionWords * 0.18 +
    dialogueWords * 0.42;

  return Math.max(
    8,
    Math.min(55, base)
  );
}

function splitSentences(value) {
  return cleanText(value)
    .split(/(?<=[.!?…])\s+/)
    .map(cleanText)
    .filter(Boolean);
}

function buildShots(scene) {
  const shots = [];
  let n = 1;

  if (scene.location) {
    shots.push({
      id: `${scene.number}.${n++}`,
      type: 'ESTABLISHING',
      camera: 'Wide establishing shot',
      visual: scene.location,
      visualPrompt: scene.location
    });
  }

  for (const action of scene.action) {
    for (const sentence of splitSentences(action)) {
      shots.push({
        id: `${scene.number}.${n++}`,
        type: 'ACTION',
        camera:
          shots.length % 2
            ? 'Medium cinematic shot'
            : 'Tracking cinematic shot',
        visual: sentence,
        visualPrompt: sentence
      });

      /*
        Action shots are capped so the plan stays practical.
        Dialogue shots below are NEVER removed.
      */
      if (
        shots.filter(s => s.type !== 'DIALOGUE').length >= 8
      ) {
        break;
      }
    }

    if (
      shots.filter(s => s.type !== 'DIALOGUE').length >= 8
    ) {
      break;
    }
  }

  /*
    CRITICAL DIALOGUE LOCK:
    Every screenplay dialogue line receives exactly one
    dedicated dialogue shot.
  */
  for (const d of scene.dialogue) {
    const visual =
      `Character ${d.speaker} performs the exact spoken line.`;

    shots.push({
      id: `${scene.number}.${n++}`,
      type: 'DIALOGUE',
      camera:
        'Performance close-up / over-the-shoulder',
      visual,
      visualPrompt: visual,
      dialogue: [
        {
          speaker: d.speaker,
          text: d.text
        }
      ]
    });
  }

  for (const emotion of scene.emotion.slice(0, 2)) {
    shots.push({
      id: `${scene.number}.${n++}`,
      type: 'EMOTION',
      camera: 'Emotional close-up',
      visual: emotion,
      visualPrompt: emotion
    });
  }

  for (const sound of scene.sound.slice(0, 1)) {
    shots.push({
      id: `${scene.number}.${n++}`,
      type: 'SOUND',
      camera: 'Atmospheric coverage',
      visual: sound,
      visualPrompt: sound
    });
  }

  return shots;
}

function mergeCharacters(parsed, supplied) {
  const map = new Map();

  for (const c of parsed || []) {
    if (!c || !text(c.name)) continue;

    map.set(
      normalizeSpeaker(c.name),
      {
        name: normalizeSpeaker(c.name),
        role: text(c.role),
        look: text(c.look),
        personality: text(c.personality),
        voice: text(c.voice),
        wardrobe: text(c.wardrobe)
      }
    );
  }

  if (Array.isArray(supplied)) {
    for (const raw of supplied) {
      if (!raw || !text(raw.name)) continue;

      const name = normalizeSpeaker(raw.name);

      const old =
        map.get(name) || {
          name,
          role: '',
          look: '',
          personality: '',
          voice: '',
          wardrobe: ''
        };

      for (const key of [
        'role',
        'look',
        'personality',
        'voice',
        'wardrobe'
      ]) {
        if (text(raw[key])) {
          old[key] = text(raw[key]);
        }
      }

      map.set(name, old);
    }
  }

  return [...map.values()];
}

function buildPlan(input) {
  const project =
    input.project &&
    typeof input.project === 'object'
      ? input.project
      : {};

  const screenplay = text(
    input.screenplay ||
    project.screenplay ||
    project.script
  );

  if (!screenplay) {
    throw new Error(
      'Paste your screenplay first.'
    );
  }

  if (
    Buffer.byteLength(
      screenplay,
      'utf8'
    ) > MAX_SCREENPLAY_BYTES
  ) {
    throw new Error(
      'Screenplay is too large. Maximum is 2 MB.'
    );
  }

  const parsed =
    parseScreenplay(screenplay);

  if (!parsed.scenes.length) {
    throw new Error(
      'No SCENE blocks found. Use headings such as SCENE 1 — The Shore.'
    );
  }

  const target = Math.max(
    20,
    Math.min(
      3600,
      Math.round(
        Number(
          input.targetLength ||
          project.targetLength ||
          project.targetMinutes * 60 ||
          240
        )
      )
    )
  );

  const requestedParts = Math.max(
    1,
    Math.min(
      6,
      Math.round(
        Number(
          input.episodes ||
          input.parts ||
          project.episodes ||
          project.parts ||
          6
        )
      )
    )
  );

  const rawDurations =
    parsed.scenes.map(
      estimateSceneSeconds
    );

  const durations =
    allocateExact(
      target,
      rawDurations,
      1
    );

  const plannedScenes =
    parsed.scenes.map((scene, i) => ({
      ...scene,
      duration: durations[i],
      shots: buildShots(scene)
    }));

  /*
    Never invent empty scenes.
    Parts contain complete scenes only.
  */
  const parts = [];

  const targetPart =
    target / requestedParts;

  let current = [];
  let currentDuration = 0;

  for (
    let i = 0;
    i < plannedScenes.length;
    i++
  ) {
    const scene =
      plannedScenes[i];

    const remainingScenes =
      plannedScenes.length - i;

    const remainingParts =
      requestedParts - parts.length;

    const shouldSplit =
      current.length > 0 &&
      currentDuration >=
        targetPart * 0.82 &&
      remainingScenes >=
        remainingParts;

    if (shouldSplit) {
      parts.push({
        episode: parts.length + 1,
        title: `Part ${parts.length + 1}`,
        duration: currentDuration,
        scenes: current
      });

      current = [];
      currentDuration = 0;
    }

    current.push(scene);
    currentDuration += scene.duration;
  }

  if (current.length) {
    parts.push({
      episode: parts.length + 1,
      title: `Part ${parts.length + 1}`,
      duration: currentDuration,
      scenes: current
    });
  }

  const dialogueLines =
    plannedScenes.reduce(
      (n, s) =>
        n + s.dialogue.length,
      0
    );

  const dialogueShots =
    plannedScenes.reduce(
      (n, s) =>
        n +
        s.shots.filter(
          x => x.type === 'DIALOGUE'
        ).length,
      0
    );

  const gpuShots =
    plannedScenes.reduce(
      (n, s) =>
        n + s.shots.length,
      0
    );

  const totalDuration =
    plannedScenes.reduce(
      (n, s) =>
        n + s.duration,
      0
    );

  const validation = {
    ok: true,
    errors: [],
    warnings: [],

    explicitScenes:
      plannedScenes.length,

    dialogueLines,

    dialogueShots,

    gpuShots,

    shots: gpuShots,

    targetDuration: target,

    plannedDuration:
      totalDuration,

    durationDifference:
      totalDuration - target,

    requestedParts,

    actualParts:
      parts.length,

    actualEpisodes:
      parts.length
  };

  if (
    dialogueLines !== dialogueShots
  ) {
    validation.ok = false;

    validation.errors.push(
      `Dialogue integrity failure: ${dialogueLines} dialogue lines but ${dialogueShots} dialogue shots.`
    );
  }

  if (
    totalDuration !== target
  ) {
    validation.ok = false;

    validation.errors.push(
      `Duration integrity failure: planned ${totalDuration}s but target is ${target}s.`
    );
  }

  if (!gpuShots) {
    validation.ok = false;

    validation.errors.push(
      'No production shots were created.'
    );
  }

  if (
    parts.length <
    requestedParts
  ) {
    validation.warnings.push(
      `Requested ${requestedParts} parts, but the screenplay contains only ${plannedScenes.length} complete scene(s). The Director will not invent or split scenes just to create empty parts.`
    );
  }

  const suppliedCharacters =
    input.characters ||
    project.characters ||
    [];

  const characters =
    mergeCharacters(
      parsed.characters,
      suppliedCharacters
    );

  const visualStyle =
    text(
      input.visualStyle ||
      project.visualStyle ||
      project.style
    ) ||
    'Cinematic Live Action';

  const format =
    text(
      input.format ||
      project.format
    );

  const subtitles =
    input.subtitle !== undefined
      ? Boolean(input.subtitle)
      : project.subtitles !== false;

  const noNarrator =
    input.noNarrator !== undefined
      ? Boolean(input.noNarrator)
      : project.noNarrator !== false;

  return {
    version:
      `AHM-DIRECTOR-${DIRECTOR_VERSION}`,

    createdAt:
      new Date().toISOString(),

    visualStyle,

    format:
      ALLOWED_FORMATS.has(format)
        ? format
        : '9:16',

    targetLength:
      target,

    subtitles,

    noNarrator,

    global: {
      ...parsed.global,

      style:
        parsed.global.style.length
          ? parsed.global.style
          : [visualStyle]
    },

    characters,

    scenes:
      plannedScenes,

    episodes:
      parts,

    /*
      Also expose parts for newer code.
    */
    parts,

    partsActual:
      parts.length,

    dialogueLines,

    dialogueShots,

    gpuShots,

    plannedSeconds:
      totalDuration,

    targetSeconds:
      target,

    validation
  };
}

function srtTime(seconds) {
  const ms = Math.max(
    0,
    Math.round(
      seconds * 1000
    )
  );

  const h =
    Math.floor(
      ms / 3600000
    );

  const m =
    Math.floor(
      (ms % 3600000) / 60000
    );

  const s =
    Math.floor(
      (ms % 60000) / 1000
    );

  const x =
    ms % 1000;

  return (
    `${String(h).padStart(2, '0')}:` +
    `${String(m).padStart(2, '0')}:` +
    `${String(s).padStart(2, '0')},` +
    `${String(x).padStart(3, '0')}`
  );
}

function makeSrt(plan) {
  const lines = [];

  let cursor = 0;
  let index = 1;

  for (
    const scene of
    plan.scenes || []
  ) {
    const duration =
      Number(scene.duration) ||
      0;

    const dialogue =
      scene.dialogue || [];

    if (!dialogue.length) {
      cursor += duration;
      continue;
    }

    /*
      Keep subtitles inside the scene.
      Each dialogue line receives a proportional
      subtitle interval.
    */
    const each =
      duration /
      dialogue.length;

    for (const d of dialogue) {
      const start =
        cursor;

      const end =
        cursor + each;

      lines.push(
        `${index}\n` +
        `${srtTime(start)} --> ${srtTime(end)}\n` +
        `${d.speaker}: ${d.text}\n`
      );

      index++;
      cursor = end;
    }

    /*
      Correct floating point drift.
    */
    cursor =
      Math.max(
        cursor,
        startOfSceneEnd(
          scene,
          cursor
        )
      );
  }

  return lines.join('\n');
}

function startOfSceneEnd(
  scene,
  cursor
) {
  return cursor;
}

function runpodConfigured() {
  return Boolean(
    text(process.env.RUNPOD_API_KEY) &&
    text(process.env.RUNPOD_ENDPOINT_ID)
  );
}

function workerMode() {
  return String(
    process.env.AHM_WORKER_MODE ||
    'demo'
  ).toLowerCase();
}

function runpodBase(endpoint) {
  return (
    `https://api.runpod.ai/v2/` +
    encodeURIComponent(endpoint)
  );
}

async function fetchJson(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      options
    );

  const body =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(body);
  } catch {
    throw new Error(
      `RunPod returned non-JSON (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `RunPod request failed (${response.status}).`
    );
  }

  return data;
}

async function submitRunpod(
  plan,
  testOnly
) {
  if (!runpodConfigured()) {
    throw new Error(
      'RunPod is not configured. Add RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID on Render before real generation.'
    );
  }

  return fetchJson(
    `${runpodBase(
      process.env.RUNPOD_ENDPOINT_ID
    )}/run`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${process.env.RUNPOD_API_KEY}`,

        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({
        input: {
          job_type:
            'ahm_video_project',

          director_version:
            DIRECTOR_VERSION,

          test_only:
            Boolean(testOnly),

          project:
            plan
        }
      })
    }
  );
}

function saveJob(job) {
  writeJson(
    path.join(
      JOBS_DIR,
      `${safeProjectId(job.id)}.json`
    ),
    job
  );
}

function loadJob(jobId) {
  return readJson(
    path.join(
      JOBS_DIR,
      `${safeProjectId(jobId)}.json`
    ),
    null
  );
}

function demoJob(plan) {
  const jobId =
    makeId('demo_');

  const job = {
    id: jobId,

    status:
      'COMPLETED',

    progress:
      100,

    message:
      'Demo validation completed. No GPU generation was charged.',

    projectId:
      makeId('project_'),

    videoUrl:
      null,

    demo:
      true,

    gpuSubmitted:
      false,

    testOnly:
      true,

    planSummary: {
      scenes:
        plan.validation.explicitScenes,

      dialogueLines:
        plan.validation.dialogueLines,

      dialogueShots:
        plan.validation.dialogueShots,

      gpuShots:
        plan.validation.gpuShots,

      targetDuration:
        plan.validation.targetDuration,

      plannedDuration:
        plan.validation.plannedDuration,

      requestedParts:
        plan.validation.requestedParts,

      actualParts:
        plan.validation.actualParts
    },

    createdAt:
      new Date().toISOString()
  };

  saveJob(job);

  return job;
}

app.get(
  '/api/health',
  (req, res) =>
    json(res, 200, {
      ok: true,

      service:
        'AHM Studio',

      directorVersion:
        DIRECTOR_VERSION,

      time:
        new Date().toISOString(),

      timestamp:
        new Date().toISOString(),

      runpodConfigured:
        runpodConfigured(),

      workerMode:
        workerMode(),

      status:
        'online'
    })
);

app.get(
  '/api/settings',
  (req, res) =>
    json(res, 200, {
      provider:
        'RunPod',

      mode:
        workerMode(),

      environment:
        process.env.NODE_ENV ||
        'production',

      endpointId:
        text(
          process.env.RUNPOD_ENDPOINT_ID
        ),

      hasApiKey:
        Boolean(
          text(
            process.env.RUNPOD_API_KEY
          )
        ),

      hasEndpoint:
        Boolean(
          text(
            process.env.RUNPOD_ENDPOINT_ID
          )
        ),

      workerMode:
        workerMode(),

      directorVersion:
        DIRECTOR_VERSION
    })
);

app.post(
  '/api/director/plan',
  (req, res) => {
    try {
      const plan =
        buildPlan(
          req.body || {}
        );

      if (!plan.validation.ok) {
        return json(
          res,
          400,
          {
            ok: false,

            error:
              'Director plan validation failed.',

            validation:
              plan.validation,

            plan
          }
        );
      }

      /*
        IMPORTANT:
        The frontend expects response.plan.
        Keep the API wrapper stable.
      */
      return json(
        res,
        200,
        {
          ok: true,
          plan
        }
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,

          error:
            e.message ||
            'Unable to build Director plan.'
        }
      );
    }
  }
);

app.post(
  '/api/projects',
  (req, res) => {
    try {
      const body =
        req.body || {};

      const project = {
        id:
          makeId('project_'),

        createdAt:
          new Date().toISOString(),

        ...body
      };

      if (
        Buffer.byteLength(
          JSON.stringify(project),
          'utf8'
        ) > MAX_PROJECT_BYTES
      ) {
        throw new Error(
          'Project is too large.'
        );
      }

      writeJson(
        path.join(
          PROJECTS_DIR,
          `${project.id}.json`
        ),
        project
      );

      return json(
        res,
        200,
        {
          ok: true,
          project
        }
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.get(
  '/api/projects',
  (req, res) => {
    try {
      const files =
        fs.readdirSync(
          PROJECTS_DIR
        )
        .filter(
          f =>
            f.endsWith('.json')
        );

      const list =
        files
          .map(
            f =>
              readJson(
                path.join(
                  PROJECTS_DIR,
                  f
                ),
                null
              )
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              String(
                b.createdAt
              ).localeCompare(
                String(
                  a.createdAt
                )
              )
          );

      return json(
        res,
        200,
        {
          ok: true,
          projects: list
        }
      );
    } catch (e) {
      return json(
        res,
        500,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.get(
  '/api/projects/:id',
  (req, res) => {
    const file =
      path.join(
        PROJECTS_DIR,
        `${safeProjectId(
          req.params.id
        )}.json`
      );

    if (!fs.existsSync(file)) {
      return json(
        res,
        404,
        {
          ok: false,
          error:
            'Project not found.'
        }
      );
    }

    return json(
      res,
      200,
      {
        ok: true,
        project:
          readJson(
            file,
            {}
          )
      }
    );
  }
);

app.post(
  '/api/subtitles',
  (req, res) => {
    try {
      const body =
        req.body || {};

      const plan =
        body.plan ||
        body;

      const fileName =
        `${safeProjectId(
          body.projectId ||
          'ahm'
        )}-subtitles.srt`;

      const file =
        path.join(
          PROJECTS_DIR,
          fileName
        );

      fs.writeFileSync(
        file,
        makeSrt(plan),
        'utf8'
      );

      return json(
        res,
        200,
        {
          ok: true,

          filename:
            fileName,

          url:
            `/files/${encodeURIComponent(
              fileName
            )}`
        }
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.post(
  '/api/generate',
  async (req, res) => {
    try {
      const body =
        req.body || {};

      let plan =
        body.plan;

      if (!plan) {
        plan =
          buildPlan(
            body.project ||
            body
          );
      }

      if (
        !plan ||
        !plan.validation ||
        !plan.validation.ok
      ) {
        return json(
          res,
          400,
          {
            ok: false,

            error:
              'Director plan validation failed.',

            validation:
              plan?.validation ||
              null
          }
        );
      }

      /*
        DEMO MODE:
        TEST RUNPOD is completely local.
        It does NOT contact RunPod.
        It does NOT spend GPU money.
      */
      if (
        workerMode() ===
        'demo'
      ) {
        if (!body.testOnly) {
          return json(
            res,
            409,
            {
              ok: false,

              error:
                'AHM is in DEMO mode. Use TEST RUNPOD for the free test, or switch AHM_WORKER_MODE to production before generating video.'
            }
          );
        }

        return json(
          res,
          200,
          demoJob(plan)
        );
      }

      /*
        PRODUCTION MODE:
        This is where the real RunPod request is made.
      */
      const result =
        await submitRunpod(
          plan,
          Boolean(
            body.testOnly
          )
        );

      const jobId =
        result.id ||
        result.jobId ||
        makeId('job_');

      const job = {
        id:
          jobId,

        status:
          result.status ||
          'IN_QUEUE',

        progress:
          1,

        message:
          'RunPod job submitted.',

        projectId:
          result.id ||
          jobId,

        runpod:
          result,

        testOnly:
          Boolean(
            body.testOnly
          ),

        demo:
          false,

        createdAt:
          new Date().toISOString()
      };

      saveJob(job);

      return json(
        res,
        200,
        job
      );
    } catch (e) {
      console.error(
        'Generation error:',
        e
      );

      return json(
        res,
        400,
        {
          ok: false,
          error:
            e.message ||
            'Generation request failed.'
        }
      );
    }
  }
);

function mapProgress(status) {
  const s =
    String(
      status || ''
    ).toUpperCase();

  if (
    s === 'COMPLETED' ||
    s === 'SUCCEEDED' ||
    s === 'READY'
  ) {
    return 100;
  }

  if (
    s === 'FAILED' ||
    s === 'CANCELLED' ||
    s === 'ERROR'
  ) {
    return 100;
  }

  if (
    s === 'IN_QUEUE'
  ) {
    return 5;
  }

  if (
    s === 'IN_PROGRESS'
  ) {
    return 50;
  }

  return 10;
}

async function statusFor(
  jobId
) {
  const id =
    text(jobId);

  if (!id) {
    throw new Error(
      'Job ID is required.'
    );
  }

  const local =
    loadJob(id);

  /*
    Local demo jobs are already complete.
    No RunPod request is made.
  */
  if (local?.demo) {
    return local;
  }

  /*
    If there is no RunPod configuration,
    return the locally saved job if possible.
  */
  if (!runpodConfigured()) {
    return (
      local || {
        id,
        status:
          'ERROR',

        progress:
          100,

        error:
          'RunPod is not configured.'
      }
    );
  }

  const data =
    await fetchJson(
      `${runpodBase(
        process.env.RUNPOD_ENDPOINT_ID
      )}/status/${encodeURIComponent(
        id
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.RUNPOD_API_KEY}`
        }
      }
    );

  const merged = {
    ...(local || {}),

    ...data,

    id,

    progress:
      mapProgress(
        data.status
      )
  };

  saveJob(merged);

  return merged;
}

/*
  GET compatibility route.
  Supports:
  /api/job-status?id=...
  /api/generate?jobId=...
*/
app.get(
  '/api/job-status',
  async (req, res) => {
    if (!req.query.id) {
      return json(
        res,
        400,
        {
          ok: false,
          error:
            'Job ID is required.'
        }
      );
    }

    try {
      return json(
        res,
        200,
        await statusFor(
          req.query.id
        )
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.post(
  '/api/job-status',
  async (req, res) => {
    if (!req.body?.id) {
      return json(
        res,
        400,
        {
          ok: false,
          error:
            'Job ID is required.'
        }
      );
    }

    try {
      return json(
        res,
        200,
        await statusFor(
          req.body.id
        )
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.get(
  '/api/generate',
  async (req, res) => {
    if (!req.query.jobId) {
      return json(
        res,
        400,
        {
          ok: false,
          error:
            'jobId is required.'
        }
      );
    }

    try {
      return json(
        res,
        200,
        await statusFor(
          req.query.jobId
        )
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.get(
  '/api/worker-health',
  async (req, res) => {
    try {
      if (
        !runpodConfigured()
      ) {
        return json(
          res,
          200,
          {
            ok: true,

            mode:
              'demo',

            message:
              'Demo mode. No GPU worker request was made.'
          }
        );
      }

      const data =
        await fetchJson(
          `${runpodBase(
            process.env.RUNPOD_ENDPOINT_ID
          )}/health`,
          {
            headers: {
              Authorization:
                `Bearer ${process.env.RUNPOD_API_KEY}`
            }
          }
        );

      return json(
        res,
        200,
        data
      );
    } catch (e) {
      return json(
        res,
        400,
        {
          ok: false,
          error: e.message
        }
      );
    }
  }
);

app.use(
  '/files',
  express.static(
    PROJECTS_DIR
  )
);

app.use(
  '/api',
  (req, res) =>
    json(
      res,
      404,
      {
        ok: false,

        error:
          `API route not found: ${req.method} ${req.originalUrl}`
      }
    )
);

if (
  fs.existsSync(
    PUBLIC_DIR
  )
) {
  app.use(
    express.static(
      PUBLIC_DIR
    )
  );

  app.get(
    '*',
    (req, res) =>
      res.sendFile(
        path.join(
          PUBLIC_DIR,
          'index.html'
        )
      )
  );
}

app.use(
  (err, req, res, next) => {
    console.error(err);

    if (
      req.path.startsWith(
        '/api'
      )
    ) {
      return json(
        res,
        500,
        {
          ok: false,

          error:
            err.message ||
            'Server error.'
        }
      );
    }

    return res
      .status(500)
      .send(
        'AHM Studio server error.'
      );
  }
);

app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `AHM Studio ${DIRECTOR_VERSION} running on http://${HOST}:${PORT}`
    );

    console.log(
      `Mode: ${
        workerMode() === 'demo'
          ? 'DEMO (no GPU charges)'
          : 'PRODUCTION'
      }`
    );
  }
);
