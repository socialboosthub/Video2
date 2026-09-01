'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

/* =========================================================
   AHM STUDIO V8 — PRODUCTION SERVER
   Screenplay → Director Plan → Validation → Mock/RunPod
   ========================================================= */

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const DATA = path.join(ROOT, 'data');
const PROJECTS = path.join(DATA, 'projects');
const SETTINGS_FILE = path.join(DATA, 'settings.json');

fs.mkdirSync(PROJECTS, { recursive: true });

app.disable('x-powered-by');

app.use(express.json({
  limit: '20mb'
}));

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function sendJson(res, status, body) {
  return res
    .status(status)
    .type('application/json')
    .send(JSON.stringify(body));
}

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(value, null, 2),
    'utf8'
  );
}

function makeId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return crypto
    .randomBytes(16)
    .toString('hex');
}

function clean(value) {
  return String(value || '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .slice(0, 80) || 'project';
}

function words(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

function parseDuration(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return 240;
  }

  return Math.round(
    clamp(n, 30, 3600)
  );
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stripQuotes(value) {
  return String(value || '')
    .trim()
    .replace(/^["“]|["”]$/g, '');
}

/* =========================================================
   SCREENPLAY PARSER
   ========================================================= */

function parseDialogueLine(line) {
  const match = String(line)
    .trim()
    .match(
      /^([A-Z][A-Z0-9 _-]{1,40})\s*:\s*(.*)$/i
    );

  if (!match) {
    return null;
  }

  const speaker = match[1]
    .trim()
    .toUpperCase();

  const text = stripQuotes(match[2]);

  if (!text) {
    return {
      speaker,
      text: '',
      pending: true
    };
  }

  return {
    speaker,
    text,
    pending: false
  };
}

function parseScreenplay(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n');

  const scenes = [];
  const characters = [];

  const global = {
    style: [],
    continuity: [],
    constraints: [],
    director: []
  };

  let scene = null;
  let section = null;
  let pendingSpeaker = null;
  let character = null;

  function finishCharacter() {
    if (!character) {
      return;
    }

    const result = {
      name: String(character.name || '')
        .trim()
        .toUpperCase(),

      role: String(character.role || '')
        .trim(),

      look: String(character.look || '')
        .trim(),

      personality: String(character.personality || '')
        .trim(),

      voice: String(character.voice || '')
        .trim(),

      wardrobe: String(character.wardrobe || '')
        .trim()
    };

    if (result.name) {
      characters.push(result);
    }

    character = null;
  }

  function finishScene() {
    if (!scene) {
      return;
    }

    scene.location = String(scene.location || '')
      .trim();

    scene.action = scene.action
      .map(x => String(x).trim())
      .filter(Boolean);

    scene.dialogue = scene.dialogue
      .filter(x => x && x.text);

    scene.emotion = scene.emotion
      .map(x => String(x).trim())
      .filter(Boolean);

    scene.sound = scene.sound
      .map(x => String(x).trim())
      .filter(Boolean);

    scene.continuity = scene.continuity
      .map(x => String(x).trim())
      .filter(Boolean);

    scenes.push(scene);

    scene = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      continue;
    }

    /* -----------------------------------------
       SCENE HEADER
       ----------------------------------------- */

    const sceneMatch = line.match(
      /^SCENE\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i
    );

    if (sceneMatch) {
      finishCharacter();
      finishScene();

      const number = Number(sceneMatch[1]);

      scene = {
        number,
        title:
          sceneMatch[2].trim() ||
          `Scene ${number}`,

        location: '',
        action: [],
        dialogue: [],
        emotion: [],
        sound: [],
        continuity: []
      };

      section = null;
      pendingSpeaker = null;

      continue;
    }

    /* -----------------------------------------
       GLOBAL INFORMATION
       ----------------------------------------- */

    if (!scene) {
      const style = line.match(
        /^STYLE\s*:\s*(.*)$/i
      );

      if (style) {
        global.style.push(
          style[1].trim()
        );

        continue;
      }

      const important = line.match(
        /^(?:IMPORTANT|CONSTRAINT|RULE)\s*:\s*(.*)$/i
      );

      if (important) {
        global.constraints.push(
          important[1].trim()
        );

        continue;
      }

      const director = line.match(
        /^DIRECTOR INSTRUCTION\s*:\s*(.*)$/i
      );

      if (director) {
        global.director.push(
          director[1].trim()
        );

        continue;
      }

      const characterHeader = line.match(
        /^CHARACTER\s*:\s*(.+)$/i
      );

      if (characterHeader) {
        finishCharacter();

        character = {
          name: characterHeader[1]
            .trim()
            .toUpperCase(),

          role: '',
          look: '',
          personality: '',
          voice: '',
          wardrobe: ''
        };

        continue;
      }

      if (character) {
        const kv = line.match(
          /^(ROLE|LOOK|PERSONALITY|VOICE|WARDROBE)\s*:\s*(.*)$/i
        );

        if (kv) {
          const key = kv[1].toLowerCase();

          if (character[key]) {
            character[key] += '\n' + kv[2].trim();
          } else {
            character[key] = kv[2].trim();
          }

          continue;
        }
      }

      continue;
    }

    /* -----------------------------------------
       SCENE SECTION HEADER
       ----------------------------------------- */

    const header = line.match(
      /^(LOCATION|ACTION|DIALOGUE|EMOTION|SOUND|CONTINUITY)\s*:\s*(.*)$/i
    );

    if (header) {
      section = header[1].toLowerCase();
      pendingSpeaker = null;

      const value = header[2].trim();

      if (value) {
        if (section === 'location') {
          scene.location +=
            (scene.location ? ' ' : '') +
            value;
        }

        if (section === 'action') {
          scene.action.push(value);
        }

        if (section === 'emotion') {
          scene.emotion.push(value);
        }

        if (section === 'sound') {
          scene.sound.push(value);
        }

        if (section === 'continuity') {
          scene.continuity.push(value);
        }
      }

      continue;
    }

    /* -----------------------------------------
       DIALOGUE
       ----------------------------------------- */

    if (section === 'dialogue') {
      const dialogue = parseDialogueLine(line);

      if (dialogue) {
        if (dialogue.pending) {
          pendingSpeaker = dialogue.speaker;
        } else {
          scene.dialogue.push({
            speaker: dialogue.speaker,
            text: dialogue.text
          });

          pendingSpeaker = null;
        }

        continue;
      }

      if (pendingSpeaker) {
        scene.dialogue.push({
          speaker: pendingSpeaker,
          text: stripQuotes(line)
        });

        pendingSpeaker = null;

        continue;
      }
    }

    /* -----------------------------------------
       OTHER SECTIONS
       ----------------------------------------- */

    if (section === 'action') {
      scene.action.push(line);
    } else if (section === 'location') {
      scene.location +=
        (scene.location ? ' ' : '') +
        line;
    } else if (section === 'emotion') {
      scene.emotion.push(line);
    } else if (section === 'sound') {
      scene.sound.push(line);
    } else if (section === 'continuity') {
      scene.continuity.push(line);
    } else {
      const dialogue = parseDialogueLine(line);

      if (dialogue && dialogue.text) {
        scene.dialogue.push({
          speaker: dialogue.speaker,
          text: dialogue.text
        });
      } else {
        scene.action.push(line);
      }
    }
  }

  finishCharacter();
  finishScene();

  /* -----------------------------------------
     REMOVE DUPLICATE CHARACTERS
     ----------------------------------------- */

  const uniqueCharacters = new Map();

  for (const c of characters) {
    uniqueCharacters.set(
      c.name,
      c
    );
  }

  return {
    scenes,
    characters: [
      ...uniqueCharacters.values()
    ],
    global
  };
}

/* =========================================================
   SCENE DURATION ENGINE
   ========================================================= */

function estimateRawSceneSeconds(scene) {
  const actionWords = words(
    scene.action.join(' ')
  );

  const dialogueWords = words(
    scene.dialogue
      .map(d => d.text)
      .join(' ')
  );

  const emotionWords = words(
    scene.emotion.join(' ')
  );

  /*
    Dialogue is slower than ordinary action because
    spoken words need actual performance time.
  */

  const dialogueSeconds =
    dialogueWords * 0.43;

  const actionSeconds =
    actionWords * 0.14;

  const emotionSeconds =
    emotionWords * 0.06;

  const base =
    5 +
    dialogueSeconds +
    actionSeconds +
    emotionSeconds;

  return clamp(
    Math.round(base),
    10,
    90
  );
}

function calculateSceneDurations(scenes, targetSeconds) {
  if (!scenes.length) {
    return [];
  }

  const raw = scenes.map(
    estimateRawSceneSeconds
  );

  const rawTotal = raw.reduce(
    (sum, value) => sum + value,
    0
  );

  /*
    Scale the screenplay to the user's target
    while maintaining relative scene importance.
  */

  const scaled = raw.map(value => {
    return Math.max(
      8,
      Math.round(
        value *
        targetSeconds /
        rawTotal
      )
    );
  });

  let difference =
    targetSeconds -
    scaled.reduce(
      (sum, value) => sum + value,
      0
    );

  /*
    Correct rounding differences without
    allowing any scene below 8 seconds.
  */

  let index = 0;

  while (difference !== 0 && index < 10000) {
    const i =
      index %
      scaled.length;

    if (difference > 0) {
      scaled[i]++;
      difference--;
    } else if (scaled[i] > 8) {
      scaled[i]--;
      difference++;
    }

    index++;
  }

  return scaled;
}

/* =========================================================
   INTELLIGENT SHOT GENERATION
   ========================================================= */

function makeShotId(sceneNumber, index) {
  return `S${String(sceneNumber).padStart(2, '0')}-SH${String(index).padStart(2, '0')}`;
}

function makeShot(
  scene,
  type,
  camera,
  visual,
  index,
  extra = {}
) {
  return {
    id: makeShotId(
      scene.number,
      index
    ),

    scene: scene.number,

    type,

    camera,

    visual,

    duration: 0,

    ...extra
  };
}

function makeShots(scene) {
  const shots = [];
  let index = 1;

  /*
    Establishing shot
  */

  if (scene.location) {
    shots.push(
      makeShot(
        scene,
        'ESTABLISHING',
        'Wide cinematic establishing shot',
        scene.location,
        index++
      )
    );
  }

  /*
    Action shots
  */

  const actions = scene.action
    .filter(Boolean);

  if (actions.length) {
    const cameraTypes = [
      'Medium cinematic shot',
      'Tracking continuation shot',
      'Close detail / reaction shot',
      'Over-the-shoulder cinematic shot'
    ];

    actions.forEach(
      (action, i) => {
        if (shots.length >= 7) {
          return;
        }

        shots.push(
          makeShot(
            scene,
            'ACTION',
            cameraTypes[
              i % cameraTypes.length
            ],
            action,
            index++
          )
        );
      }
    );
  }

  /*
    Dialogue shot
  */

  if (scene.dialogue.length) {
    const speakers = [
      ...new Set(
        scene.dialogue.map(
          d => d.speaker
        )
      )
    ];

    let camera;

    if (speakers.length >= 2) {
      camera =
        'Cinematic two-shot with alternating close-ups';
    } else {
      camera =
        'Cinematic performance close-up';
    }

    shots.push(
      makeShot(
        scene,
        'DIALOGUE',
        camera,
        'Deliver the exact locked dialogue. Do not alter, paraphrase, add or remove dialogue.',
        index++,
        {
          dialogue: scene.dialogue
        }
      )
    );
  }

  /*
    Emotion shot
  */

  if (
    scene.emotion.length &&
    shots.length < 8
  ) {
    shots.push(
      makeShot(
        scene,
        'EMOTION',
        'Cinematic emotional close-up',
        scene.emotion.join(' '),
        index++
      )
    );
  }

  /*
    Sound / atmosphere
  */

  if (
    scene.sound.length &&
    shots.length < 8
  ) {
    shots.push(
      makeShot(
        scene,
        'ATMOSPHERE',
        'Cinematic environmental coverage',
        scene.sound.join(' '),
        index++
      )
    );
  }

  /*
    Safety fallback
  */

  if (!shots.length) {
    shots.push(
      makeShot(
        scene,
        'GENERAL',
        'Cinematic medium shot',
        scene.location ||
        scene.title,
        index++
      )
    );
  }

  return shots;
}

/* =========================================================
   SHOT DURATION ALLOCATION
   ========================================================= */

function allocateShotDurations(
  shots,
  sceneDuration
) {
  if (!shots.length) {
    return [];
  }

  const weights = shots.map(
    shot => {
      if (shot.type === 'DIALOGUE') {
        const dialogueWords = words(
          (shot.dialogue || [])
            .map(d => d.text)
            .join(' ')
        );

        return Math.max(
          2,
          dialogueWords * 0.43
        );
      }

      if (shot.type === 'ESTABLISHING') {
        return 4;
      }

      if (shot.type === 'EMOTION') {
        return 4;
      }

      if (shot.type === 'ATMOSPHERE') {
        return 3;
      }

      return 3;
    }
  );

  const weightTotal =
    weights.reduce(
      (a, b) => a + b,
      0
    );

  const durations = weights.map(
    weight =>
      Math.max(
        2,
        Math.round(
          sceneDuration *
          weight /
          weightTotal
        )
      )
  );

  let difference =
    sceneDuration -
    durations.reduce(
      (a, b) => a + b,
      0
    );

  let guard = 0;

  while (
    difference !== 0 &&
    guard < 10000
  ) {
    const i =
      guard %
      durations.length;

    if (difference > 0) {
      durations[i]++;
      difference--;
    } else if (durations[i] > 2) {
      durations[i]--;
      difference++;
    }

    guard++;
  }

  return durations;
}

/* =========================================================
   GENERATION PROMPT BUILDER
   ========================================================= */

function buildCharacterContinuity(
  characters
) {
  if (!characters.length) {
    return 'No external character library was supplied.';
  }

  return characters
    .map(c => {
      return [
        `CHARACTER: ${c.name}`,
        `ROLE: ${c.role || 'Not specified'}`,
        `LOOK: ${c.look || 'Not specified'}`,
        `PERSONALITY: ${c.personality || 'Not specified'}`,
        `VOICE: ${c.voice || 'Not specified'}`,
        `WARDROBE: ${c.wardrobe || 'Not specified'}`
      ].join('\n');
    })
    .join('\n\n');
}

function buildShotPrompt(
  plan,
  scene,
  shot
) {
  const style =
    plan.visualStyle ||
    'Cinematic live-action';

  const characters =
    buildCharacterContinuity(
      plan.characters || []
    );

  const globalRules = [
    'Preserve exact character identity.',
    'Preserve facial appearance and body proportions.',
    'Preserve wardrobe and physical continuity.',
    'Do not invent story events.',
    'Do not invent dialogue.',
    'Do not change dialogue wording.',
    'Do not add a narrator.',
    'Do not add subtitles inside the generated video.',
    'Maintain chronological continuity.',
    'Maintain location continuity.',
    'Use realistic cinematic movement.',
    'Avoid distorted faces, extra limbs or duplicated characters.'
  ];

  return [
    `AHM STUDIO V8 CINEMATIC VIDEO SHOT`,
    ``,
    `VISUAL STYLE: ${style}`,
    `FORMAT: ${plan.format || '9:16'}`,
    ``,
    `GLOBAL PRODUCTION RULES:`,
    globalRules
      .map(x => `- ${x}`)
      .join('\n'),
    ``,
    `CHARACTER CONTINUITY:`,
    characters,
    ``,
    `SCENE ${scene.number}: ${scene.title}`,
    ``,
    `LOCATION:`,
    scene.location || 'Maintain the established scene location.',
    ``,
    `SHOT TYPE: ${shot.type}`,
    `CAMERA: ${shot.camera}`,
    ``,
    `SHOT ACTION / VISUAL:`,
    shot.visual,
    ``,
    shot.dialogue
      ? `EXACT DIALOGUE:\n${shot.dialogue.map(d => `${d.speaker}: "${d.text}"`).join('\n')}`
      : '',
    ``,
    `EMOTION:`,
    scene.emotion.join(' ') || 'Natural performance.',
    ``,
    `SOUND / ATMOSPHERE:`,
    scene.sound.join(' ') || 'Natural environmental sound.',
    ``,
    `CONTINUITY:`,
    scene.continuity.join(' ') || 'Continue directly from the previous shot.',
    ``,
    `END SHOT NATURALLY AND PRESERVE CONTINUITY FOR THE NEXT SHOT.`
  ]
    .filter(Boolean)
    .join('\n');
}

/* =========================================================
   EPISODE / PART BALANCING
   ========================================================= */

function makeEpisodes(
  scenes,
  requestedEpisodes,
  totalSeconds,
  characters,
  visualStyle,
  format
) {
  const requested = clamp(
    Number(requestedEpisodes) || 5,
    1,
    12
  );

  const durations =
    calculateSceneDurations(
      scenes,
      totalSeconds
    );

  const preparedScenes =
    scenes.map(
      (scene, index) => {
        const shots =
          makeShots(scene);

        const shotDurations =
          allocateShotDurations(
            shots,
            durations[index]
          );

        const finalShots =
          shots.map(
            (shot, shotIndex) => ({
              ...shot,

              duration:
                shotDurations[
                  shotIndex
                ] || 2,

              prompt:
                buildShotPrompt(
                  {
                    characters,
                    visualStyle,
                    format
                  },
                  scene,
                  shot
                )
            })
          );

        return {
          ...scene,

          duration:
            durations[index],

          shots: finalShots
        };
      }
    );

  /*
    We group scenes by balanced duration.

    This prevents the old behaviour where the
    final part could become extremely long.
  */

  const total =
    preparedScenes.reduce(
      (sum, scene) =>
        sum + scene.duration,
      0
    );

  const targetPart =
    total / requested;

  const buckets = [];

  let current = [];
  let currentDuration = 0;

  for (
    let i = 0;
    i < preparedScenes.length;
    i++
  ) {
    const scene =
      preparedScenes[i];

    const remainingScenes =
      preparedScenes.length -
      i;

    const remainingParts =
      requested -
      buckets.length;

    const mustLeave =
      remainingScenes <=
      remainingParts - 1;

    const wouldOvershoot =
      current.length > 0 &&
      currentDuration +
        scene.duration >
        targetPart * 1.18;

    if (
      current.length &&
      !mustLeave &&
      wouldOvershoot &&
      buckets.length <
        requested - 1
    ) {
      buckets.push({
        scenes: current,
        duration: currentDuration
      });

      current = [];
      currentDuration = 0;
    }

    current.push(scene);
    currentDuration +=
      scene.duration;
  }

  if (current.length) {
    buckets.push({
      scenes: current,
      duration: currentDuration
    });
  }

  /*
    If we ended up with fewer parts than requested,
    split the largest buckets where possible.
  */

  while (
    buckets.length < requested
  ) {
    let largestIndex = -1;
    let largestDuration = 0;

    for (
      let i = 0;
      i < buckets.length;
      i++
    ) {
      if (
        buckets[i].scenes.length > 1 &&
        buckets[i].duration >
          largestDuration
      ) {
        largestDuration =
          buckets[i].duration;
        largestIndex = i;
      }
    }

    if (largestIndex === -1) {
      break;
    }

    const bucket =
      buckets[largestIndex];

    const middle =
      Math.ceil(
        bucket.scenes.length / 2
      );

    const first =
      bucket.scenes.slice(
        0,
        middle
      );

    const second =
      bucket.scenes.slice(
        middle
      );

    const firstDuration =
      first.reduce(
        (sum, s) =>
          sum + s.duration,
        0
      );

    const secondDuration =
      second.reduce(
        (sum, s) =>
          sum + s.duration,
        0
      );

    buckets.splice(
      largestIndex,
      1,
      {
        scenes: first,
        duration: firstDuration
      },
      {
        scenes: second,
        duration: secondDuration
      }
    );
  }

  return buckets.map(
    (bucket, index) => ({
      episode: index + 1,

      title:
        `Part ${index + 1}`,

      duration:
        bucket.duration,

      scenes:
        bucket.scenes
    })
  );
}

/* =========================================================
   VALIDATION
   ========================================================= */

function validatePlan(plan) {
  const errors = [];
  const warnings = [];

  if (!plan) {
    errors.push(
      'Director plan is missing.'
    );

    return {
      valid: false,
      errors,
      warnings
    };
  }

  if (
    !Array.isArray(plan.scenes) &&
    !Array.isArray(plan.episodes)
  ) {
    errors.push(
      'No scenes or episodes found.'
    );
  }

  const episodes =
    Array.isArray(plan.episodes)
      ? plan.episodes
      : [];

  const scenes =
    episodes.flatMap(
      e => e.scenes || []
    );

  if (!scenes.length) {
    errors.push(
      'No production scenes found.'
    );
  }

  const dialogueLines =
    scenes.reduce(
      (sum, scene) =>
        sum +
        (scene.dialogue || [])
          .length,
      0
    );

  const shotCount =
    scenes.reduce(
      (sum, scene) =>
        sum +
        (scene.shots || [])
          .length,
      0
    );

  const duration =
    episodes.reduce(
      (sum, episode) =>
        sum +
        safeNumber(
          episode.duration
        ),
      0
    );

  if (
    Math.abs(
      duration -
      plan.targetLength
    ) > 1
  ) {
    errors.push(
      `Episode duration total ${duration}s does not equal target ${plan.targetLength}s.`
    );
  }

  if (
    plan.noNarrator !== true
  ) {
    warnings.push(
      'Narrator setting is enabled.'
    );
  }

  for (
    const scene of scenes
  ) {
    if (!scene.location) {
      warnings.push(
        `Scene ${scene.number} has no explicit location.`
      );
    }

    if (
      !Array.isArray(scene.shots) ||
      !scene.shots.length
    ) {
      errors.push(
        `Scene ${scene.number} has no shots.`
      );
    }

    for (
      const shot of scene.shots || []
    ) {
      if (!shot.prompt) {
        errors.push(
          `${shot.id || 'Shot'} has no generation prompt.`
        );
      }
    }
  }

  return {
    valid:
      errors.length === 0,

    errors,

    warnings,

    totals: {
      scenes: scenes.length,
      dialogueLines,
      shots: shotCount,
      duration
    }
  };
}

/* =========================================================
   BUILD DIRECTOR PLAN
   ========================================================= */

function buildPlan(input) {
  const screenplay =
    String(
      input.screenplay || ''
    ).trim();

  if (!screenplay) {
    throw new Error(
      'Paste your screenplay first.'
    );
  }

  const parsed =
    parseScreenplay(
      screenplay
    );

  if (!parsed.scenes.length) {
    throw new Error(
      'No explicit SCENE blocks were found. Use headings like SCENE 1 — TITLE.'
    );
  }

  const targetLength =
    parseDuration(
      input.targetLength ||
      240
    );

  const visualStyle =
    String(
      input.visualStyle ||
      parsed.global.style.join(' ') ||
      'Cinematic Live Action'
    ).trim();

  const format =
    String(
      input.format ||
      '9:16'
    );

  const suppliedCharacters =
    Array.isArray(
      input.characters
    )
      ? input.characters
      : [];

  const mergedCharacters =
    new Map();

  for (
    const character of parsed.characters
  ) {
    mergedCharacters.set(
      character.name,
      character
    );
  }

  for (
    const character of suppliedCharacters
  ) {
    if (
      character &&
      character.name
    ) {
      const name =
        String(
          character.name
        )
          .trim()
          .toUpperCase();

      mergedCharacters.set(
        name,
        {
          role:
            character.role ||
            '',
          look:
            character.look ||
            '',
          personality:
            character.personality ||
            '',
          voice:
            character.voice ||
            '',
          wardrobe:
            character.wardrobe ||
            '',
          ...character,
          name
        }
      );
    }
  }

  const characters =
    [...mergedCharacters.values()];

  const episodes =
    makeEpisodes(
      parsed.scenes,
      input.episodes || 5,
      targetLength,
      characters,
      visualStyle,
      format
    );

  const allScenes =
    episodes.flatMap(
      e => e.scenes
    );

  const dialogueLines =
    allScenes.reduce(
      (sum, scene) =>
        sum +
        scene.dialogue.length,
      0
    );

  const shotCount =
    allScenes.reduce(
      (sum, scene) =>
        sum +
        scene.shots.length,
      0
    );

  const plan = {
    version:
      'AHM-DIRECTOR-V8.0',

    createdAt:
      new Date().toISOString(),

    visualStyle,

    format,

    targetLength,

    subtitles:
      input.subtitle !== false,

    noNarrator:
      input.noNarrator !== false,

    global:
      parsed.global,

    characters,

    episodes,

    validation: {
      explicitScenes:
        parsed.scenes.length,

      dialogueLines,

      shots:
        shotCount,

      requestedEpisodes:
        Number(
          input.episodes
        ) || 5,

      actualEpisodes:
        episodes.length
    }
  };

  plan.validationReport =
    validatePlan(plan);

  return plan;
}

/* =========================================================
   SETTINGS
   ========================================================= */

function getStoredSettings() {
  return readJson(
    SETTINGS_FILE,
    {}
  );
}

function settings() {
  const stored =
    getStoredSettings();

  const mode =
    stored.mode ||
    process.env.WORKER_MODE ||
    'serverless';

  const endpointId =
    stored.endpointId ||
    process.env.RUNPOD_ENDPOINT_ID ||
    '';

  const workerUrl =
    stored.workerUrl ||
    process.env.WORKER_URL ||
    '';

  const mockMode =
    stored.mockMode === true ||
    String(
      process.env.MOCK_MODE || ''
    ).toLowerCase() === 'true';

  return {
    provider:
      'RunPod',

    version:
      '8.0',

    mode,

    endpointId,

    workerUrl,

    mockMode,

    hasApiKey:
      Boolean(
        stored.apiKey ||
        process.env.RUNPOD_API_KEY
      )
  };
}

function apiKey() {
  const stored =
    getStoredSettings();

  return (
    stored.apiKey ||
    process.env.RUNPOD_API_KEY ||
    ''
  );
}

function requireKey() {
  if (!apiKey()) {
    throw new Error(
      'RunPod API key is not configured. Add RUNPOD_API_KEY in Render Environment Variables or save it through Settings.'
    );
  }
}

/* =========================================================
   API — HEALTH
   ========================================================= */

app.get(
  '/api/health',
  (req, res) => {
    sendJson(
      res,
      200,
      {
        ok: true,
        service:
          'AHM Studio V8',
        version:
          '8.0.0',
        time:
          new Date().toISOString()
      }
    );
  }
);

/* =========================================================
   API — SETTINGS
   ========================================================= */

app.get(
  '/api/settings',
  (req, res) => {
    sendJson(
      res,
      200,
      settings()
    );
  }
);

app.post(
  '/api/settings',
  (req, res) => {
    try {
      const body =
        req.body || {};

      const old =
        getStoredSettings();

      const next = {
        mode:
          body.mode === 'direct'
            ? 'direct'
            : 'serverless',

        endpointId:
          String(
            body.endpointId ||
            old.endpointId ||
            ''
          ).trim(),

        workerUrl:
          String(
            body.workerUrl ||
            old.workerUrl ||
            ''
          ).trim(),

        mockMode:
          Boolean(
            body.mockMode ??
            old.mockMode ??
            false
          )
      };

      if (
        String(
          body.apiKey || ''
        ).trim()
      ) {
        next.apiKey =
          String(
            body.apiKey
          ).trim();
      } else if (
        old.apiKey
      ) {
        next.apiKey =
          old.apiKey;
      }

      if (
        body.clearApiKey
      ) {
        delete next.apiKey;
      }

      writeJson(
        SETTINGS_FILE,
        next
      );

      sendJson(
        res,
        200,
        {
          ok: true,
          ...settings()
        }
      );
    } catch (error) {
      sendJson(
        res,
        500,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   API — DIRECTOR PLAN
   ========================================================= */

app.post(
  '/api/director/plan',
  (req, res) => {
    try {
      const plan =
        buildPlan(
          req.body || {}
        );

      sendJson(
        res,
        200,
        plan
      );
    } catch (error) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   API — VALIDATE EXISTING PLAN
   ========================================================= */

app.post(
  '/api/director/validate',
  (req, res) => {
    try {
      const report =
        validatePlan(
          req.body || {}
        );

      sendJson(
        res,
        report.valid ? 200 : 400,
        {
          ok:
            report.valid,
          report
        }
      );
    } catch (error) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   API — PROJECTS
   ========================================================= */

app.post(
  '/api/projects',
  (req, res) => {
    try {
      const project = {
        id: makeId(),

        createdAt:
          new Date().toISOString(),

        ...(
          req.body || {}
        )
      };

      writeJson(
        path.join(
          PROJECTS,
          `${project.id}.json`
        ),
        project
      );

      sendJson(
        res,
        200,
        project
      );
    } catch (error) {
      sendJson(
        res,
        500,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

app.get(
  '/api/projects',
  (req, res) => {
    try {
      const list =
        fs.readdirSync(
          PROJECTS
        )
          .filter(
            file =>
              file.endsWith('.json')
          )
          .map(
            file =>
              readJson(
                path.join(
                  PROJECTS,
                  file
                ),
                {}
              )
          )
          .sort(
            (a, b) =>
              String(
                b.createdAt || ''
              ).localeCompare(
                String(
                  a.createdAt || ''
                )
              )
          );

      sendJson(
        res,
        200,
        list
      );
    } catch (error) {
      sendJson(
        res,
        500,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

app.get(
  '/api/projects/:id',
  (req, res) => {
    try {
      const projectId =
        clean(
          req.params.id
        );

      const file =
        path.join(
          PROJECTS,
          `${projectId}.json`
        );

      if (
        !fs.existsSync(file)
      ) {
        return sendJson(
          res,
          404,
          {
            ok: false,
            error:
              'Project not found'
          }
        );
      }

      sendJson(
        res,
        200,
        readJson(
          file,
          {}
        )
      );
    } catch (error) {
      sendJson(
        res,
        500,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   SUBTITLE GENERATION
   ========================================================= */

function srtTime(seconds) {
  const ms =
    Math.max(
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
      (ms % 3600000) /
      60000
    );

  const s =
    Math.floor(
      (ms % 60000) /
      1000
    );

  const x =
    ms % 1000;

  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0')
  ].join(':') +
    ',' +
    String(x).padStart(3, '0');
}

function makeSrt(episode) {
  let cursor = 0;
  let index = 1;

  const output = [];

  for (
    const scene of
    episode.scenes || []
  ) {
    const sceneStart =
      cursor;

    const sceneDuration =
      safeNumber(
        scene.duration,
        0
      );

    const dialogue =
      scene.dialogue || [];

    if (
      dialogue.length
    ) {
      const weights =
        dialogue.map(
          d =>
            Math.max(
              1,
              words(d.text)
            )
        );

      const totalWeight =
        weights.reduce(
          (a, b) =>
            a + b,
          0
        );

      let dialogueCursor =
        sceneStart;

      dialogue.forEach(
        (line, i) => {
          const duration =
            Math.max(
              1.2,
              sceneDuration *
              weights[i] /
              totalWeight
            );

          const start =
            dialogueCursor;

          const end =
            Math.min(
              sceneStart +
                sceneDuration,
              start +
                duration
            );

          output.push(
            `${index++}\n` +
            `${srtTime(start)} --> ${srtTime(end)}\n` +
            `${line.speaker}: ${line.text}\n`
          );

          dialogueCursor =
            end;
        }
      );
    }

    cursor +=
      sceneDuration;
  }

  return output.join('\n');
}

app.post(
  '/api/subtitles',
  (req, res) => {
    try {
      const episode =
        req.body?.episode;

      if (!episode) {
        throw new Error(
          'Episode is required.'
        );
      }

      const projectId =
        clean(
          req.body.projectId ||
          'ahm'
        );

      const episodeNumber =
        Number(
          episode.episode
        ) || 1;

      const filename =
        `${projectId}-part-${episodeNumber}.srt`;

      const file =
        path.join(
          PROJECTS,
          filename
        );

      fs.writeFileSync(
        file,
        makeSrt(episode),
        'utf8'
      );

      sendJson(
        res,
        200,
        {
          ok: true,

          url:
            `/files/${encodeURIComponent(filename)}`,

          filename
        }
      );
    } catch (error) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   GENERATED FILES
   ========================================================= */

app.use(
  '/files',
  express.static(
    PROJECTS,
    {
      fallthrough: false
    }
  )
);

/* =========================================================
   RUNPOD
   ========================================================= */

function runpodUrl(
  endpoint,
  suffix
) {
  return (
    `https://api.runpod.ai/v2/` +
    `${encodeURIComponent(endpoint)}/` +
    suffix
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

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      `Upstream returned non-JSON (${response.status}): ${text.slice(0, 500)}`
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data.error ||
      data.message ||
      `Upstream request failed (${response.status}).`
    );
  }

  return data;
}

/* =========================================================
   MOCK JOB
   ========================================================= */

function createMockJob(
  plan
) {
  const jobId =
    `mock-${makeId()}`;

  const job = {
    id: jobId,

    status:
      'COMPLETED',

    mode:
      'mock',

    createdAt:
      new Date().toISOString(),

    completedAt:
      new Date().toISOString(),

    message:
      'AHM Studio V8 mock generation completed. No GPU credits were used.',

    project: {
      version:
        plan.version,

      targetLength:
        plan.targetLength,

      format:
        plan.format,

      episodes:
        plan.episodes.length,

      scenes:
        plan.validation
          ?.explicitScenes ||
        0,

      shots:
        plan.validation
          ?.shots ||
        0
    },

    outputs: []
  };

  return job;
}

/* =========================================================
   SUBMIT PRODUCTION JOB
   ========================================================= */

async function submitProductionJob(
  plan
) {
  const stored =
    getStoredSettings();

  const mock =
    stored.mockMode === true ||
    String(
      process.env.MOCK_MODE || ''
    ).toLowerCase() ===
      'true';

  if (mock) {
    return createMockJob(
      plan
    );
  }

  requireKey();

  const mode =
    stored.mode ||
    process.env.WORKER_MODE ||
    'serverless';

  const payload = {
    input: {
      job_type:
        'ahm_video_project',

      director_version:
        '8.0',

      project:
        plan
    }
  };

  /*
    DIRECT WORKER MODE
  */

  if (
    mode === 'direct'
  ) {
    const workerUrl =
      String(
        stored.workerUrl ||
        process.env.WORKER_URL ||
        ''
      ).replace(
        /\/$/,
        ''
      );

    if (!workerUrl) {
      throw new Error(
        'Direct worker URL is missing.'
      );
    }

    return fetchJson(
      workerUrl,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey()}`,

          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );
  }

  /*
    RUNPOD SERVERLESS MODE
  */

  const endpoint =
    stored.endpointId ||
    process.env.RUNPOD_ENDPOINT_ID ||
    '';

  if (!endpoint) {
    throw new Error(
      'RunPod endpoint ID is missing.'
    );
  }

  return fetchJson(
    runpodUrl(
      endpoint,
      'run'
    ),
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${apiKey()}`,

        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify(
          payload
        )
    }
  );
}

/* =========================================================
   API — GENERATE
   ========================================================= */

app.post(
  '/api/generate',
  async (req, res) => {
    try {
      const plan =
        req.body || {};

      const validation =
        validatePlan(
          plan
        );

      if (
        !validation.valid
      ) {
        return sendJson(
          res,
          400,
          {
            ok: false,

            error:
              'Director plan failed validation.',

            validation
          }
        );
      }

      const result =
        await submitProductionJob(
          plan
        );

      sendJson(
        res,
        200,
        result
      );
    } catch (error) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   API — JOB STATUS
   ========================================================= */

app.post(
  '/api/job-status',
  async (req, res) => {
    try {
      const jobId =
        req.body?.id;

      if (!jobId) {
        throw new Error(
          'Job ID is required.'
        );
      }

      /*
        Mock jobs do not need RunPod.
      */

      if (
        String(
          jobId
        ).startsWith('mock-')
      ) {
        return sendJson(
          res,
          200,
          {
            id: jobId,
            status:
              'COMPLETED',
            mode:
              'mock',
            message:
              'Mock job completed without using GPU credits.'
          }
        );
      }

      requireKey();

      const stored =
        getStoredSettings();

      const endpoint =
        stored.endpointId ||
        process.env.RUNPOD_ENDPOINT_ID ||
        '';

      if (!endpoint) {
        throw new Error(
          'RunPod endpoint ID is missing.'
        );
      }

      const data =
        await fetchJson(
          runpodUrl(
            endpoint,
            `status/${encodeURIComponent(jobId)}`
          ),
          {
            headers: {
              Authorization:
                `Bearer ${apiKey()}`
            }
          }
        );

      sendJson(
        res,
        200,
        data
      );
    } catch (error) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   API — WORKER HEALTH
   ========================================================= */

app.get(
  '/api/worker-health',
  async (req, res) => {
    try {
      const stored =
        getStoredSettings();

      const mock =
        stored.mockMode === true ||
        String(
          process.env.MOCK_MODE || ''
        ).toLowerCase() ===
          'true';

      if (mock) {
        return sendJson(
          res,
          200,
          {
            ok: true,

            mode:
              'mock',

            message:
              'Mock worker is ready. No RunPod credits are being used.'
          }
        );
      }

      requireKey();

      const endpoint =
        stored.endpointId ||
        process.env.RUNPOD_ENDPOINT_ID ||
        '';

      if (!endpoint) {
        throw new Error(
          'RunPod endpoint ID is missing.'
        );
      }

      const data =
        await fetchJson(
          runpodUrl(
            endpoint,
            'health'
          ),
          {
            headers: {
              Authorization:
                `Bearer ${apiKey()}`
            }
          }
        );

      sendJson(
        res,
        200,
        data
      );
    } catch (error) {
      sendJson(
        res,
        400,
        {
          ok: false,
          error:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   API 404
   ========================================================= */

app.use(
  '/api',
  (req, res) => {
    sendJson(
      res,
      404,
      {
        ok: false,

        error:
          `API route not found: ${req.method} ${req.originalUrl}`
      }
    );
  }
);

/* =========================================================
   FRONTEND
   ========================================================= */

const PUBLIC_DIR =
  path.join(
    ROOT,
    'public'
  );

app.use(
  express.static(
    PUBLIC_DIR
  )
);

/*
  Express 4 catch-all.
  Keep this AFTER API routes and
  static files.
*/

app.get(
  '*',
  (req, res) => {
    const indexFile =
      path.join(
        PUBLIC_DIR,
        'index.html'
      );

    if (
      fs.existsSync(indexFile)
    ) {
      return res.sendFile(
        indexFile
      );
    }

    return res
      .status(404)
      .send(
        'AHM Studio frontend is not installed.'
      );
  }
);

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'AHM SERVER ERROR:',
      error
    );

    if (
      req.path.startsWith(
        '/api'
      )
    ) {
      return sendJson(
        res,
        500,
        {
          ok: false,

          error:
            error.message ||
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

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `AHM Studio V8 running on port ${PORT}`
    );

    console.log(
      `Mock mode: ${
        settings().mockMode
          ? 'ON'
          : 'OFF'
      }`
    );

    console.log(
      `Worker mode: ${
        settings().mode
      }`
    );
  }
);
