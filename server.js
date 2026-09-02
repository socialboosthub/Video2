require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

/* =========================================================
   AHM STUDIO V8.2
   AI FILM DIRECTOR
   ---------------------------------------------------------
   FIXED:
   - robust screenplay parsing
   - dialogue section parsing
   - multiline dialogue
   - blank-line-safe dialogue
   - character speaker detection
   - action/dialogue separation
   - exact duration allocation
   - balanced parts
   - dedicated dialogue shots
   - exact subtitles
   - RunPod integration
   - demo-mode safety
========================================================= */

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 10000);

const RUNPOD_API_KEY = String(
  process.env.RUNPOD_API_KEY || ""
).trim();

const RUNPOD_ENDPOINT_ID = String(
  process.env.RUNPOD_ENDPOINT_ID || ""
).trim();

const WORKER_MODE = String(
  process.env.AHM_WORKER_MODE || "demo"
)
  .trim()
  .toLowerCase();

const DIRECTOR_VERSION = "8.2";

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

const MAX_SCREENPLAY_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_BYTES = 8 * 1024 * 1024;

const ALLOWED_FORMATS = new Set([
  "9:16",
  "16:9",
  "1:1"
]);

/* =========================================================
   DIRECTOR STRUCTURAL LABELS
========================================================= */

const STRUCTURAL_LABELS = new Set([
  "LOCATION",
  "ACTION",
  "DIALOGUE",
  "DIALOGUE — LOCKED",
  "DIALOGUE - LOCKED",
  "STYLE",
  "MAIN CHARACTERS",
  "CHARACTERS",
  "CHARACTER",
  "IMPORTANT",
  "CONTINUITY",
  "VISUAL STYLE",
  "FORMAT",
  "TARGET LENGTH",
  "PARTS",
  "SUBTITLES",
  "NARRATOR",
  "VOICE OVER",
  "VOICEOVER",
  "SOUND",
  "MUSIC",
  "CAMERA"
]);

/* =========================================================
   STARTUP DIRECTORIES
========================================================= */

fs.mkdirSync(PROJECTS_DIR, {
  recursive: true
});

/* =========================================================
   EXPRESS
========================================================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

/* =========================================================
   BASIC HELPERS
========================================================= */

function makeId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return (
    Date.now() +
    "-" +
    crypto.randomBytes(8).toString("hex")
  );
}

function safeNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function round(value) {
  return Math.round(value);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeSpeaker(value) {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function cleanDialogueText(value) {
  return cleanText(value)
    .replace(/^["“]/, "")
    .replace(/["”]$/, "")
    .trim();
}

function countWords(text) {
  return cleanText(text)
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function fileSizeBytes(text) {
  return Buffer.byteLength(
    String(text || ""),
    "utf8"
  );
}

function jsonError(
  res,
  status,
  message,
  extra = {}
) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra
  });
}

function jsonOk(res, data = {}) {
  return res.json({
    ok: true,
    ...data
  });
}

function sanitizeFilename(value) {
  return String(value || "project")
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .slice(0, 100);
}

/* =========================================================
   SCREENPLAY NORMALIZATION
========================================================= */

function normalizeScreenplay(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u2014/g, "—")
    .replace(/\u2013/g, "–")
    .trim();
}

/* =========================================================
   SCENE DETECTION
========================================================= */

function isSceneHeading(line) {
  const value = cleanText(line);

  return /^SCENE\s+\d+\s*[—:-]/i.test(
    value
  );
}

function extractSceneNumber(line) {
  const match = cleanText(line).match(
    /^SCENE\s+(\d+)/i
  );

  return match
    ? Number(match[1])
    : null;
}

function extractSceneTitle(line) {
  const value = cleanText(line);

  const match = value.match(
    /^SCENE\s+\d+\s*[—:-]\s*(.+)$/i
  );

  return match
    ? cleanText(match[1])
    : value;
}

/* =========================================================
   STRUCTURAL LABEL HELPERS
========================================================= */

function getStructuralLabel(line) {
  const value = cleanText(line);

  const match = value.match(
    /^([A-Za-z][A-Za-z0-9 _.'-]{0,80})\s*:\s*(.*)$/u
  );

  if (!match) {
    return null;
  }

  const label = normalizeSpeaker(
    match[1]
  );

  if (!STRUCTURAL_LABELS.has(label)) {
    return null;
  }

  return {
    label,
    value: cleanText(match[2])
  };
}

function isStructuralLine(line) {
  const value = cleanText(line);

  if (!value) {
    return false;
  }

  if (
    /^(LOCATION|ACTION|DIALOGUE|DIALOGUE — LOCKED|DIALOGUE - LOCKED|STYLE|IMPORTANT|MAIN CHARACTERS|CHARACTERS|CHARACTER|CONTINUITY|VISUAL STYLE|FORMAT|TARGET LENGTH|PARTS|SUBTITLES|NARRATOR|VOICE OVER|VOICEOVER|SOUND|MUSIC|CAMERA)\s*:/i.test(
      value
    )
  ) {
    return true;
  }

  return /^(LOCATION|ACTION|DIALOGUE|DIALOGUE — LOCKED|DIALOGUE - LOCKED|STYLE|IMPORTANT|MAIN CHARACTERS|CHARACTERS|CHARACTER|CONTINUITY|VISUAL STYLE|FORMAT|TARGET LENGTH|PARTS|SUBTITLES|NARRATOR|VOICE OVER|VOICEOVER|SOUND|MUSIC|CAMERA)$/i.test(
    value
  );
}

/* =========================================================
   SPEAKER LABEL DETECTION
========================================================= */

function parseSpeakerLine(line) {
  const value = cleanText(line);

  if (!value) {
    return null;
  }

  const match = value.match(
    /^([A-Za-z][A-Za-z0-9 _.'-]{0,60})\s*:\s*(.*)$/u
  );

  if (!match) {
    return null;
  }

  const speaker = normalizeSpeaker(
    match[1]
  );

  if (
    STRUCTURAL_LABELS.has(speaker)
  ) {
    return null;
  }

  /*
   * Prevent normal prose containing a colon from being
   * treated as dialogue.
   *
   * Speaker labels should look like names:
   * ELIAS
   * MARA
   * GOLDEN FISH
   * PEOPLE
   */
  if (
    !/^[A-Z][A-Z0-9 _.'-]{0,60}$/.test(
      speaker
    )
  ) {
    return null;
  }

  return {
    speaker,
    text: cleanDialogueText(
      match[2]
    )
  };
}

/* =========================================================
   DIALOGUE PARSER
   ---------------------------------------------------------
   This is the critical V8.2 fix.

   Supported formats:

   ELIAS:
   "Where are you?"

   ELIAS: "Where are you?"

   MARA:
   Where are you?

   GOLDEN FISH:
   "I can grant one wish."

   DIALOGUE:
   ELIAS:
   "Hello."

   MARA:
   "Goodbye."
========================================================= */

function parseDialogueFromLines(
  lines
) {
  const dialogue = [];

  let currentSpeaker = null;
  let currentParts = [];
  let dialogueSection = false;

  function flushDialogue() {
    if (
      !currentSpeaker ||
      !currentParts.length
    ) {
      currentSpeaker = null;
      currentParts = [];
      return;
    }

    const text = cleanDialogueText(
      currentParts.join(" ")
    );

    if (text) {
      dialogue.push({
        id: makeId(),
        speaker: currentSpeaker,
        text
      });
    }

    currentSpeaker = null;
    currentParts = [];
  }

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const raw = String(
      lines[index] || ""
    );

    const line = cleanText(raw);

    /*
     * IMPORTANT:
     * Blank lines do NOT flush dialogue.
     *
     * This fixes the previous V8.1 bug.
     */
    if (!line) {
      continue;
    }

    /*
     * Scene headings always terminate the current dialogue.
     */
    if (isSceneHeading(line)) {
      flushDialogue();
      dialogueSection = false;
      continue;
    }

    /*
     * Structural labels.
     */
    const structural =
      getStructuralLabel(line);

    if (structural) {
      const label =
        structural.label;

      /*
       * DIALOGUE: explicitly enters dialogue mode.
       */
      if (
        label === "DIALOGUE" ||
        label === "DIALOGUE — LOCKED" ||
        label === "DIALOGUE - LOCKED"
      ) {
        flushDialogue();
        dialogueSection = true;

        /*
         * Rare format:
         * DIALOGUE: ELIAS says hello
         *
         * We do not invent a speaker here.
         */
        continue;
      }

      /*
       * ACTION or LOCATION terminates dialogue mode.
       */
      if (
        label === "ACTION" ||
        label === "LOCATION"
      ) {
        flushDialogue();
        dialogueSection = false;
        continue;
      }

      /*
       * Other structural sections terminate dialogue too.
       */
      flushDialogue();
      dialogueSection = false;
      continue;
    }

    /*
     * Speaker line.
     */
    const speakerLine =
      parseSpeakerLine(line);

    if (speakerLine) {
      /*
       * New speaker means previous speaker is complete.
       */
      flushDialogue();

      currentSpeaker =
        speakerLine.speaker;

      if (speakerLine.text) {
        currentParts.push(
          speakerLine.text
        );

        /*
         * Same-line dialogue is complete.
         */
        flushDialogue();
      }

      /*
       * Standalone speaker:
       *
       * ELIAS:
       * "Hello."
       *
       * Continue reading next lines.
       */
      dialogueSection = true;

      continue;
    }

    /*
     * If a speaker is currently open, collect the line.
     *
     * Blank lines were already ignored above, so dialogue
     * can safely span blank lines.
     */
    if (currentSpeaker) {
      /*
       * If this looks like another structural section,
       * terminate the dialogue.
       */
      if (
        isStructuralLine(line)
      ) {
        flushDialogue();
        dialogueSection = false;
        continue;
      }

      /*
       * Keep quoted and normal continuation lines.
       */
      currentParts.push(
        cleanDialogueText(line)
      );

      continue;
    }

    /*
     * DIALOGUE section without a currently open speaker:
     *
     * We intentionally DO NOT invent a speaker.
     *
     * This prevents ordinary action prose from becoming fake
     * dialogue.
     */
    if (dialogueSection) {
      continue;
    }
  }

  flushDialogue();

  return dialogue;
}

/* =========================================================
   LOCATION EXTRACTION
========================================================= */

function extractLocation(
  lines
) {
  for (const raw of lines) {
    const line = cleanText(raw);

    const match =
      line.match(
        /^LOCATION\s*:\s*(.+)$/i
      );

    if (match) {
      return cleanText(
        match[1]
      );
    }
  }

  return "";
}

/* =========================================================
   ACTION EXTRACTION
   ---------------------------------------------------------
   Uses the same speaker rules as the dialogue parser.
========================================================= */

function extractActionLines(
  lines
) {
  const action = [];

  let dialogueMode = false;
  let currentSpeaker = false;

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const raw = String(
      lines[index] || ""
    );

    const line = cleanText(raw);

    if (!line) {
      continue;
    }

    if (isSceneHeading(line)) {
      continue;
    }

    const structural =
      getStructuralLabel(line);

    if (structural) {
      const label =
        structural.label;

      if (
        label === "DIALOGUE" ||
        label === "DIALOGUE — LOCKED" ||
        label === "DIALOGUE - LOCKED"
      ) {
        dialogueMode = true;
        currentSpeaker = false;
        continue;
      }

      if (
        label === "ACTION"
      ) {
        dialogueMode = false;
        currentSpeaker = false;

        if (structural.value) {
          action.push(
            structural.value
          );
        }

        continue;
      }

      if (
        label === "LOCATION"
      ) {
        dialogueMode = false;
        currentSpeaker = false;
        continue;
      }

      /*
       * Other structural blocks are ignored.
       */
      dialogueMode = false;
      currentSpeaker = false;
      continue;
    }

    const speaker =
      parseSpeakerLine(line);

    if (speaker) {
      dialogueMode = true;
      currentSpeaker = true;

      /*
       * Speaker's same-line text is dialogue, not action.
       */
      continue;
    }

    if (
      currentSpeaker ||
      dialogueMode
    ) {
      /*
       * Dialogue section content is not action.
       */
      continue;
    }

    action.push(line);
  }

  return action;
}

/* =========================================================
   BUILD ACTION TEXT
========================================================= */

function buildActionText(
  lines
) {
  return extractActionLines(
    lines
  )
    .map(cleanText)
    .filter(Boolean)
    .join(" ")
    .trim();
}

/* =========================================================
   SCENE PARSER
========================================================= */

function parseScenes(
  screenplay
) {
  const normalized =
    normalizeScreenplay(
      screenplay
    );

  const lines =
    normalized.split("\n");

  const scenes = [];

  let current = null;

  function flushScene() {
    if (!current) {
      return;
    }

    const rawLines =
      current.lines.slice();

    const location =
      extractLocation(
        rawLines
      );

    const dialogue =
      parseDialogueFromLines(
        rawLines
      );

    const action =
      buildActionText(
        rawLines
      );

    scenes.push({
      number:
        current.number,

      title:
        current.title,

      location,

      action,

      dialogue,

      raw:
        rawLines
    });

    current = null;
  }

  for (const raw of lines) {
    const line = cleanText(raw);

    if (
      isSceneHeading(line)
    ) {
      flushScene();

      current = {
        number:
          extractSceneNumber(
            line
          ),

        title:
          extractSceneTitle(
            line
          ),

        lines: []
      };

      continue;
    }

    /*
     * Ignore material before the first SCENE heading.
     */
    if (!current) {
      continue;
    }

    /*
     * Preserve blank lines inside a scene.
     * The dialogue parser deliberately ignores them.
     */
    current.lines.push(
      line
    );
  }

  flushScene();

  return scenes;
}

/* =========================================================
   CHARACTER EXTRACTION
========================================================= */

function extractCharacters(
  screenplay
) {
  const text =
    normalizeScreenplay(
      screenplay
    );

  const result = [];

  const knownNames = [
    "ELIAS",
    "MARA",
    "GOLDEN FISH",
    "PEOPLE"
  ];

  for (const name of knownNames) {
    const escaped =
      name.replace(
        /\s+/g,
        "\\s+"
      );

    const regex =
      new RegExp(
        `^\\s*-?\\s*${escaped}\\s*:\\s*(.+)$`,
        "im"
      );

    const match =
      text.match(regex);

    if (match) {
      result.push({
        name,
        description:
          cleanText(
            match[1]
          )
      });
    }
  }

  return result;
}

/* =========================================================
   SPEAKER LABEL DETECTION
========================================================= */

function screenplayHasSpeakerLabels(
  screenplay
) {
  const text =
    normalizeScreenplay(
      screenplay
    );

  return /^(ELIAS|MARA|GOLDEN FISH|PEOPLE)\s*:/im.test(
    text
  );
}

/* =========================================================
   DIALOGUE COUNTS
========================================================= */

function countDialogueLines(
  scenes
) {
  return scenes.reduce(
    (total, scene) =>
      total +
      scene.dialogue.length,
    0
  );
}

function countDialogueWords(
  scenes
) {
  return scenes.reduce(
    (total, scene) =>
      total +
      scene.dialogue.reduce(
        (sum, line) =>
          sum +
          countWords(
            line.text
          ),
        0
      ),
    0
  );
}

/* =========================================================
   RAW SCENE DURATION
========================================================= */

function estimateSceneSeconds(
  scene
) {
  const actionWords =
    countWords(
      scene.action
    );

  const dialogueWords =
    scene.dialogue.reduce(
      (sum, line) =>
        sum +
        countWords(
          line.text
        ),
      0
    );

  /*
   * Approximate cinematic pacing.
   */
  const actionSeconds =
    actionWords / 3.0;

  const dialogueSeconds =
    dialogueWords / 2.2;

  /*
   * Small cinematic breathing room.
   */
  const baseline = 6;

  return clamp(
    baseline +
      actionSeconds +
      dialogueSeconds,
    8,
    60
  );
}

/* =========================================================
   TARGET DURATION
========================================================= */

function getTargetDuration(
  body
) {
  const value =
    safeNumber(
      body?.targetLength ??
        body?.targetDuration ??
        240,
      240
    );

  return clamp(
    round(value),
    20,
    3600
  );
}

/* =========================================================
   EXACT SCENE DURATION ALLOCATION
========================================================= */

function allocateSceneDurations(
  scenes,
  targetSeconds
) {
  if (!scenes.length) {
    return [];
  }

  const minimum =
    8;

  const minimumTotal =
    minimum *
    scenes.length;

  /*
   * For very short targets with many scenes, the mathematically
   * possible minimum is larger than the requested target.
   *
   * For the normal 4-minute test this will never be a problem.
   */
  const effectiveTarget =
    Math.max(
      round(targetSeconds),
      minimumTotal
    );

  const raw =
    scenes.map(
      estimateSceneSeconds
    );

  const rawTotal =
    raw.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  if (
    rawTotal <= 0
  ) {
    const result =
      Array(
        scenes.length
      ).fill(
        minimum
      );

    let remaining =
      effectiveTarget -
      result.reduce(
        (a, b) => a + b,
        0
      );

    let index = 0;

    while (
      remaining > 0
    ) {
      result[
        index %
          result.length
      ] += 1;

      remaining--;
      index++;
    }

    return result;
  }

  /*
   * Initial proportional allocation.
   */
  const values =
    raw.map(
      value =>
        Math.max(
          minimum,
          (value /
            rawTotal) *
            effectiveTarget
        )
    );

  /*
   * Convert to integers.
   */
  const result =
    values.map(
      value =>
        Math.max(
          minimum,
          Math.floor(value)
        )
    );

  let total =
    result.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  /*
   * Add remaining seconds according to largest fractions.
   */
  if (
    total <
    effectiveTarget
  ) {
    const order =
      values
        .map(
          (value, index) => ({
            index,
            fraction:
              value -
              Math.floor(value)
          })
        )
        .sort(
          (a, b) =>
            b.fraction -
            a.fraction
        );

    let cursor = 0;

    while (
      total <
      effectiveTarget
    ) {
      const item =
        order[
          cursor %
            order.length
        ];

      result[
        item.index
      ] += 1;

      total++;
      cursor++;
    }
  }

  /*
   * Remove seconds if necessary, never going below minimum.
   */
  while (
    total >
    effectiveTarget
  ) {
    let changed =
      false;

    for (
      let i =
        result.length - 1;
      i >= 0;
      i--
    ) {
      if (
        result[i] >
        minimum
      ) {
        result[i]--;
        total--;
        changed = true;

        if (
          total ===
          effectiveTarget
        ) {
          break;
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  return result;
}

/* =========================================================
   ACTION SENTENCE SPLITTING
========================================================= */

function splitActionSentences(
  action
) {
  const text =
    cleanText(action);

  if (!text) {
    return [];
  }

  const matches =
    text.match(
      /[^.!?]+(?:[.!?]+|$)/g
    );

  if (!matches) {
    return [text];
  }

  return matches
    .map(cleanText)
    .filter(Boolean);
}

/* =========================================================
   SHOT DURATION ALLOCATION
========================================================= */

function allocateShotDurations(
  shotCount,
  totalSeconds
) {
  if (
    shotCount <= 0
  ) {
    return [];
  }

  totalSeconds =
    Math.max(
      1,
      round(totalSeconds)
    );

  /*
   * Normal case.
   */
  const base =
    Math.floor(
      totalSeconds /
        shotCount
    );

  const remainder =
    totalSeconds %
    shotCount;

  const result =
    Array(
      shotCount
    ).fill(
      Math.max(
        1,
        base
      )
    );

  /*
   * Distribute remainder exactly.
   */
  for (
    let i = 0;
    i < remainder;
    i++
  ) {
    result[i]++;
  }

  return result;
}

/* =========================================================
   SHOT TYPE
========================================================= */

function chooseShotType(
  index,
  total,
  hasDialogue,
  speaker
) {
  if (
    hasDialogue &&
    speaker
  ) {
    return "MEDIUM / DIALOGUE";
  }

  if (
    index === 0
  ) {
    return "ESTABLISHING";
  }

  if (
    index ===
    total - 1
  ) {
    return "CLOSE / REACTION";
  }

  const cycle = [
    "MEDIUM",
    "TRACKING",
    "OVER-THE-SHOULDER",
    "CLOSE / REACTION",
    "WIDE"
  ];

  return cycle[
    index %
      cycle.length
  ];
}

/* =========================================================
   CINEMATIC SHOT PLANNER
   ---------------------------------------------------------
   CRITICAL FIX:
   Dialogue shots are NEVER merged away.
========================================================= */

function makeShots(
  scene
) {
  const actionSentences =
    splitActionSentences(
      scene.action
    );

  const dialogue =
    scene.dialogue || [];

  /*
   * Build dialogue units first.
   * Each dialogue line is sacred and must remain its own
   * shot.
   */
  const dialogueUnits =
    dialogue.map(
      line => ({
        kind:
          "dialogue",

        speaker:
          line.speaker,

        text:
          line.text,

        dialogueId:
          line.id
      })
    );

  /*
   * Build action units.
   */
  const actionUnits =
    actionSentences.map(
      sentence => ({
        kind:
          "action",

        text:
          sentence
      })
    );

  /*
   * Add location as an establishing visual only when there
   * is enough action to support it.
   */
  const locationUnit =
    scene.location
      ? {
          kind:
            "action",
          text:
            `Establish the environment: ${scene.location}.`
        }
      : null;

  /*
   * Combine in story order.
   */
  let units = [];

  if (locationUnit) {
    units.push(
      locationUnit
    );
  }

  units =
    units.concat(
      actionUnits
    );

  /*
   * Dialogue is appended as dedicated units.
   *
   * Most importantly, these units will never be merged.
   */
  units =
    units.concat(
      dialogueUnits
    );

  /*
   * If scene contains nothing usable, create one fallback
   * shot.
   */
  if (!units.length) {
    units = [
      {
        kind:
          "action",

        text:
          scene.title ||
          "Cinematic scene."
      }
    ];
  }

  /*
   * We can reduce excessive ACTION shots, but NEVER reduce
   * dialogue shots.
   */
  const MAX_ACTION_SHOTS = 8;

  const actions =
    units.filter(
      unit =>
        unit.kind ===
        "action"
    );

  const dialogues =
    units.filter(
      unit =>
        unit.kind ===
        "dialogue"
    );

  /*
   * Reduce action units if there are too many.
   */
  let reducedActions =
    actions;

  if (
    actions.length >
    MAX_ACTION_SHOTS
  ) {
    reducedActions = [];

    /*
     * Keep the first action as establishing information.
     */
    reducedActions.push(
      actions[0]
    );

    const remaining =
      actions.slice(1);

    const buckets =
      Math.min(
        MAX_ACTION_SHOTS - 1,
        remaining.length
      );

    for (
      let i = 0;
      i < buckets;
      i++
    ) {
      const start =
        Math.floor(
          (i *
            remaining.length) /
            buckets
        );

      const end =
        Math.floor(
          ((i + 1) *
            remaining.length) /
            buckets
        );

      const chunk =
        remaining.slice(
          start,
          end
        );

      if (
        chunk.length
      ) {
        reducedActions.push({
          kind:
            "action",

          text:
            chunk
              .map(
                item =>
                  item.text
              )
              .join(" ")
        });
      }
    }
  }

  /*
   * Preserve dialogue in its original order relative to the
   * scene as much as possible.
   *
   * Since dialogue must remain dedicated, we simply place
   * action shots before dialogue shots when the parser cannot
   * recover exact interleaving.
   */
  const selected =
    reducedActions.concat(
      dialogues
    );

  const durations =
    allocateShotDurations(
      selected.length,
      scene.duration
    );

  return selected.map(
    (unit, index) => {
      const dialogue =
        unit.kind ===
        "dialogue";

      const type =
        chooseShotType(
          index,
          selected.length,
          dialogue,
          unit.speaker
        );

      return {
        id:
          makeId(),

        scene:
          scene.number,

        shot:
          index + 1,

        type,

        duration:
          durations[index],

        speaker:
          dialogue
            ? unit.speaker
            : null,

        dialogueId:
          dialogue
            ? unit.dialogueId
            : null,

        action:
          dialogue
            ? `Character performs the scripted dialogue naturally while maintaining exact identity, emotion and continuity.`
            : unit.text,

        dialogue:
          dialogue
            ? unit.text
            : null,

        visualPrompt:
          buildVisualPrompt(
            scene,
            unit,
            type
          )
      };
    }
  );
}

/* =========================================================
   VISUAL PROMPT
========================================================= */

function buildVisualPrompt(
  scene,
  unit,
  shotType
) {
  const location =
    scene.location ||
    "the established scene location";

  const continuity =
    [
      "Maintain exact character identity.",
      "Maintain exact face, age, hair and wardrobe.",
      "Maintain prop continuity.",
      "Maintain geography and lighting continuity.",
      "Maintain chronological story state.",
      "Do not invent story events."
    ].join(" ");

  if (
    unit.kind ===
    "dialogue"
  ) {
    return [
      `Live-action cinematic ${shotType.toLowerCase()} shot.`,
      `Location: ${location}.`,
      `Speaker: ${unit.speaker}.`,
      `Performance: natural human acting with accurate lip movement and facial emotion.`,
      `Exact scripted dialogue: "${unit.text}"`,
      continuity
    ].join(" ");
  }

  return [
    `Live-action cinematic ${shotType.toLowerCase()} shot.`,
    `Location: ${location}.`,
    `Action: ${unit.text}`,
    continuity
  ].join(" ");
}

/* =========================================================
   SUBTITLE GENERATION
========================================================= */

function buildSubtitles(
  scenes
) {
  const subtitles = [];

  let cursor = 0;

  for (const scene of scenes) {
    const dialogue =
      scene.dialogue || [];

    if (
      !dialogue.length
    ) {
      cursor +=
        scene.duration;

      continue;
    }

    const weights =
      dialogue.map(
        line =>
          Math.max(
            1,
            countWords(
              line.text
            )
          )
      );

    const totalWeight =
      weights.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    let local =
      cursor;

    for (
      let i = 0;
      i < dialogue.length;
      i++
    ) {
      const line =
        dialogue[i];

      const share =
        scene.duration *
        (
          weights[i] /
          totalWeight
        );

      const start =
        Math.round(
          local * 1000
        ) / 1000;

      const end =
        Math.round(
          (local + share) *
            1000
        ) / 1000;

      subtitles.push({
        id:
          line.id,

        scene:
          scene.number,

        speaker:
          line.speaker,

        text:
          line.text,

        start,

        end
      });

      local += share;
    }

    cursor +=
      scene.duration;
  }

  return subtitles;
}

/* =========================================================
   BALANCED PART SPLITTING
========================================================= */

function splitScenesIntoParts(
  scenes,
  partCount
) {
  if (
    !scenes.length
  ) {
    return [];
  }

  const count =
    clamp(
      round(
        partCount || 1
      ),
      1,
      scenes.length
    );

  if (
    count === 1
  ) {
    return [
      scenes.slice()
    ];
  }

  const n =
    scenes.length;

  const prefix =
    Array(n + 1).fill(0);

  for (
    let i = 0;
    i < n;
    i++
  ) {
    prefix[i + 1] =
      prefix[i] +
      scenes[i].duration;
  }

  const target =
    prefix[n] / count;

  const dp =
    Array.from(
      {
        length:
          count + 1
      },
      () =>
        Array(
          n + 1
        ).fill(
          Infinity
        )
    );

  const cuts =
    Array.from(
      {
        length:
          count + 1
      },
      () =>
        Array(
          n + 1
        ).fill(-1)
    );

  dp[0][0] = 0;

  for (
    let parts = 1;
    parts <= count;
    parts++
  ) {
    for (
      let end = parts;
      end <= n;
      end++
    ) {
      for (
        let start =
          parts - 1;
        start < end;
        start++
      ) {
        if (
          !Number.isFinite(
            dp[
              parts - 1
            ][start]
          )
        ) {
          continue;
        }

        const duration =
          prefix[end] -
          prefix[start];

        const cost =
          Math.pow(
            duration -
              target,
            2
          );

        const candidate =
          dp[
            parts - 1
          ][start] +
          cost;

        if (
          candidate <
          dp[parts][end]
        ) {
          dp[parts][end] =
            candidate;

          cuts[parts][end] =
            start;
        }
      }
    }
  }

  const groups = [];

  let end = n;

  for (
    let part = count;
    part >= 1;
    part--
  ) {
    const start =
      cuts[part][end];

    if (
      start < 0
    ) {
      return fallbackSplitScenes(
        scenes,
        count
      );
    }

    groups.unshift(
      scenes.slice(
        start,
        end
      )
    );

    end =
      start;
  }

  return groups;
}

/* =========================================================
   FALLBACK PART SPLIT
========================================================= */

function fallbackSplitScenes(
  scenes,
  partCount
) {
  const groups = [];

  let start = 0;

  for (
    let part = 0;
    part < partCount;
    part++
  ) {
    const remainingScenes =
      scenes.length -
      start;

    const remainingParts =
      partCount -
      part;

    const take =
      Math.ceil(
        remainingScenes /
          remainingParts
      );

    groups.push(
      scenes.slice(
        start,
        start + take
      )
    );

    start += take;
  }

  return groups;
}

/* =========================================================
   PART BUILDER
========================================================= */

function makeParts(
  scenes,
  requestedParts
) {
  const groups =
    splitScenesIntoParts(
      scenes,
      requestedParts
    );

  return groups.map(
    (group, index) => {
      const duration =
        group.reduce(
          (sum, scene) =>
            sum +
            scene.duration,
          0
        );

      const shots =
        group.flatMap(
          scene =>
            scene.shots
        );

      return {
        part:
          index + 1,

        duration,

        scenes:
          group.map(
            scene =>
              scene.number
          ),

        shots
      };
    }
  );
}

/* =========================================================
   PLAN VALIDATION
========================================================= */

function validatePlan(
  plan
) {
  const errors = [];
  const warnings = [];

  if (
    !Array.isArray(
      plan.scenes
    ) ||
    !plan.scenes.length
  ) {
    errors.push(
      "No screenplay scenes were detected."
    );
  }

  if (
    plan.targetSeconds <= 0
  ) {
    errors.push(
      "Target duration must be greater than zero."
    );
  }

  if (
    !ALLOWED_FORMATS.has(
      plan.format
    )
  ) {
    errors.push(
      `Unsupported format: ${plan.format}`
    );
  }

  /*
   * Critical dialogue validation.
   */
  if (
    plan.dialogueLines === 0 &&
    plan.screenplayContainsSpeakerLabels
  ) {
    errors.push(
      "Speaker labels were detected but no dialogue lines were extracted."
    );
  }

  /*
   * Every extracted dialogue line must produce a subtitle
   * when subtitles are enabled.
   */
  if (
    plan.subtitlesEnabled &&
    plan.dialogueLines > 0 &&
    plan.subtitles.length !==
      plan.dialogueLines
  ) {
    errors.push(
      `Subtitle count mismatch: ${plan.dialogueLines} dialogue lines but ${plan.subtitles.length} subtitles were generated.`
    );
  }

  if (
    plan.gpuShots === 0 &&
    plan.scenes.length > 0
  ) {
    errors.push(
      "Scenes exist but no GPU shots were created."
    );
  }

  /*
   * Every dialogue line must have a dedicated shot.
   */
  if (
    plan.dialogueLines > 0 &&
    plan.dialogueShots <
      plan.dialogueLines
  ) {
    errors.push(
      `Dialogue shot mismatch: ${plan.dialogueLines} dialogue lines but only ${plan.dialogueShots} dedicated dialogue shots were created.`
    );
  }

  /*
   * Exact duration should normally be guaranteed.
   */
  if (
    plan.plannedSeconds !==
    plan.targetSeconds
  ) {
    errors.push(
      `Duration mismatch: planned ${plan.plannedSeconds}s but target is ${plan.targetSeconds}s.`
    );
  }

  /*
   * Parts must contain all scenes.
   */
  const scenesInParts =
    plan.parts.reduce(
      (total, part) =>
        total +
        part.scenes.length,
      0
    );

  if (
    scenesInParts !==
    plan.scenes.length
  ) {
    errors.push(
      "Part planning does not contain every screenplay scene."
    );
  }

  /*
   * Warnings only.
   */
  if (
    plan.scenes.some(
      scene =>
        !scene.location
    )
  ) {
    warnings.push(
      "One or more scenes have no explicit LOCATION."
    );
  }

  if (
    plan.scenes.some(
      scene =>
        !scene.action &&
        scene.dialogue.length ===
          0
    )
  ) {
    warnings.push(
      "One or more scenes contain no extracted action or dialogue."
    );
  }

  return {
    errors,
    warnings
  };
}

/* =========================================================
   DIRECTOR PLAN BUILDER
========================================================= */

function buildDirectorPlan({
  screenplay,
  format = "9:16",
  targetSeconds = 240,
  parts = 6,
  subtitles = true,
  narrator = false
}) {
  const normalized =
    normalizeScreenplay(
      screenplay
    );

  const scenes =
    parseScenes(
      normalized
    );

  const characters =
    extractCharacters(
      normalized
    );

  const hasSpeakerLabels =
    screenplayHasSpeakerLabels(
      normalized
    );

  /*
   * Exact duration allocation.
   */
  const durations =
    allocateSceneDurations(
      scenes,
      targetSeconds
    );

  const finalScenes =
    scenes.map(
      (scene, index) => {
        const duration =
          durations[index];

        const prepared = {
          ...scene,

          duration,

          estimatedRawDuration:
            round(
              estimateSceneSeconds(
                scene
              )
            )
        };

        const shots =
          makeShots(
            prepared
          );

        return {
          ...prepared,
          shots
        };
      }
    );

  /*
   * Recalculate shot durations after shot generation.
   */
  for (
    const scene of finalScenes
  ) {
    const shotDurations =
      allocateShotDurations(
        scene.shots.length,
        scene.duration
      );

    scene.shots =
      scene.shots.map(
        (shot, index) => ({
          ...shot,

          duration:
            shotDurations[index]
        })
      );
  }

  const dialogueLines =
    countDialogueLines(
      finalScenes
    );

  const dialogueWords =
    countDialogueWords(
      finalScenes
    );

  const subtitlesData =
    subtitles
      ? buildSubtitles(
          finalScenes
        )
      : [];

  const actualParts =
    makeParts(
      finalScenes,
      parts
    );

  const gpuShots =
    finalScenes.reduce(
      (sum, scene) =>
        sum +
        scene.shots.length,
      0
    );

  const dialogueShots =
    finalScenes.reduce(
      (sum, scene) =>
        sum +
        scene.shots.filter(
          shot =>
            Boolean(
              shot.dialogue
            )
        ).length,
      0
    );

  const plannedSeconds =
    finalScenes.reduce(
      (sum, scene) =>
        sum +
        scene.duration,
      0
    );

  const plan = {
    id:
      makeId(),

    directorVersion:
      DIRECTOR_VERSION,

    createdAt:
      new Date().toISOString(),

    format:
      ALLOWED_FORMATS.has(
        format
      )
        ? format
        : "9:16",

    targetSeconds:
      round(
        targetSeconds
      ),

    plannedSeconds:
      round(
        plannedSeconds
      ),

    partsRequested:
      clamp(
        round(parts),
        1,
        Math.max(
          1,
          finalScenes.length
        )
      ),

    partsActual:
      actualParts.length,

    subtitlesEnabled:
      Boolean(subtitles),

    subtitleMode:
      subtitles
        ? "EXACT DIALOGUE"
        : "OFF",

    narrator:
      Boolean(narrator),

    narratorMode:
      narrator
        ? "SCRIPTED ONLY"
        : "OFF",

    globalStyle:
      "Live-action fantasy short film, realistic human actors, cinematic lighting, realistic ocean, natural facial expressions, dramatic acting.",

    continuityLock: [
      "Character identity remains locked.",
      "Character appearance remains locked.",
      "Voice identity remains locked.",
      "Wardrobe remains locked unless explicitly changed by screenplay.",
      "Props remain locked unless explicitly changed by screenplay.",
      "Geography remains locked.",
      "Chronological story events remain locked.",
      "No invented story events.",
      "No narrator unless explicitly scripted."
    ],

    screenplayWords:
      countWords(
        normalized
      ),

    dialogueLines,

    dialogueWords,

    dialogueShots,

    gpuShots,

    screenplayContainsSpeakerLabels:
      hasSpeakerLabels,

    characters,

    scenes:
      finalScenes,

    parts:
      actualParts,

    subtitles:
      subtitlesData
  };

  const validation =
    validatePlan(
      plan
    );

  plan.validation =
    validation;

  plan.ready =
    validation.errors.length ===
    0;

  return plan;
}

/* =========================================================
   RUNPOD
========================================================= */

function runPodConfigured() {
  return Boolean(
    RUNPOD_API_KEY &&
      RUNPOD_ENDPOINT_ID
  );
}

function runPodBaseUrl() {
  return (
    "https://api.runpod.ai/v2/" +
    encodeURIComponent(
      RUNPOD_ENDPOINT_ID
    )
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
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = {
      raw: text
    };
  }

  if (
    !response.ok
  ) {
    const error =
      new Error(
        `HTTP ${response.status}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return data;
}

/* =========================================================
   RUNPOD SUBMIT
========================================================= */

async function submitRunPodJob({
  plan,
  testOnly = false
}) {
  if (
    !runPodConfigured()
  ) {
    throw new Error(
      "RunPod is not configured. Add RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID on the server."
    );
  }

  const payload = {
    input: {
      job_type:
        "ahm_video_project",

      director_version:
        DIRECTOR_VERSION,

      test_only:
        Boolean(
          testOnly
        ),

      project:
        plan
    }
  };

  return fetchJson(
    `${runPodBaseUrl()}/run`,
    {
      method:
        "POST",

      headers: {
        Authorization:
          `Bearer ${RUNPOD_API_KEY}`,

        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(
          payload
        )
    }
  );
}

/* =========================================================
   RUNPOD STATUS
========================================================= */

async function getRunPodStatus(
  jobId
) {
  if (
    !runPodConfigured()
  ) {
    throw new Error(
      "RunPod is not configured."
    );
  }

  return fetchJson(
    `${runPodBaseUrl()}/status/${encodeURIComponent(
      jobId
    )}`,
    {
      method:
        "GET",

      headers: {
        Authorization:
          `Bearer ${RUNPOD_API_KEY}`
      }
    }
  );
}

/* =========================================================
   RUNPOD HEALTH
========================================================= */

async function getRunPodHealth() {
  if (
    !runPodConfigured()
  ) {
    throw new Error(
      "RunPod is not configured."
    );
  }

  return fetchJson(
    `${runPodBaseUrl()}/health`,
    {
      method:
        "GET",

      headers: {
        Authorization:
          `Bearer ${RUNPOD_API_KEY}`
      }
    }
  );
}

/* =========================================================
   PROJECT STORAGE
========================================================= */

function projectPath(
  id
) {
  return path.join(
    PROJECTS_DIR,
    `${sanitizeFilename(
      id
    )}.json`
  );
}

function saveProject(
  project
) {
  const id =
    project.id ||
    makeId();

  const finalProject = {
    ...project,

    id,

    savedAt:
      new Date().toISOString()
  };

  const serialized =
    JSON.stringify(
      finalProject,
      null,
      2
    );

  if (
    fileSizeBytes(
      serialized
    ) >
    MAX_PROJECT_BYTES
  ) {
    throw new Error(
      "Project is too large to save."
    );
  }

  fs.writeFileSync(
    projectPath(id),
    serialized,
    "utf8"
  );

  return finalProject;
}

function readProject(
  id
) {
  const filename =
    projectPath(id);

  if (
    !fs.existsSync(
      filename
    )
  ) {
    return null;
  }

  return JSON.parse(
    fs.readFileSync(
      filename,
      "utf8"
    )
  );
}

function listProjects() {
  return fs
    .readdirSync(
      PROJECTS_DIR
    )
    .filter(
      name =>
        name.endsWith(
          ".json"
        )
    )
    .map(name => {
      try {
        return JSON.parse(
          fs.readFileSync(
            path.join(
              PROJECTS_DIR,
              name
            ),
            "utf8"
          )
        );
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        String(
          b.savedAt ||
            ""
        ).localeCompare(
          String(
            a.savedAt ||
              ""
          )
        )
    );
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    return jsonOk(
      res,
      {
        service:
          "AHM Studio",

        version:
          DIRECTOR_VERSION,

        status:
          "online",

        workerMode:
          WORKER_MODE,

        runpodConfigured:
          runPodConfigured(),

        timestamp:
          new Date().toISOString()
      }
    );
  }
);

/* =========================================================
   SETTINGS
========================================================= */

app.get(
  "/api/settings",
  (req, res) => {
    return jsonOk(
      res,
      {
        environment:
          process.env.NODE_ENV ||
          "development",

        hasApiKey:
          Boolean(
            RUNPOD_API_KEY
          ),

        hasEndpoint:
          Boolean(
            RUNPOD_ENDPOINT_ID
          ),

        workerMode:
          WORKER_MODE,

        directorVersion:
          DIRECTOR_VERSION
      }
    );
  }
);

/* =========================================================
   DIRECTOR PLAN
========================================================= */

app.post(
  "/api/director/plan",
  (req, res) => {
    try {
      const {
        screenplay,

        format =
          "9:16",

        targetLength =
          240,

        parts =
          6,

        subtitles =
          true,

        narrator =
          false
      } =
        req.body || {};

      if (
        typeof screenplay !==
          "string" ||
        !screenplay.trim()
      ) {
        return jsonError(
          res,
          400,
          "A screenplay is required."
        );
      }

      if (
        fileSizeBytes(
          screenplay
        ) >
        MAX_SCREENPLAY_BYTES
      ) {
        return jsonError(
          res,
          413,
          "The screenplay is too large."
        );
      }

      const targetSeconds =
        getTargetDuration({
          targetLength
        });

      const plan =
        buildDirectorPlan({
          screenplay,

          format,

          targetSeconds,

          parts,

          subtitles,

          narrator
        });

      /*
       * Always log the validation result on Render.
       *
       * This means if anything genuinely fails, the backend
       * log will tell us exactly why.
       */
      console.log(
        "DIRECTOR PLAN:",
        {
          scenes:
            plan.scenes.length,

          dialogueLines:
            plan.dialogueLines,

          dialogueShots:
            plan.dialogueShots,

          gpuShots:
            plan.gpuShots,

          targetSeconds:
            plan.targetSeconds,

          plannedSeconds:
            plan.plannedSeconds,

          ready:
            plan.ready,

          errors:
            plan.validation.errors,

          warnings:
            plan.validation.warnings
        }
      );

      if (
        !plan.ready
      ) {
        return res
          .status(422)
          .json({
            ok:
              false,

            error:
              "Director plan validation failed.",

            plan
          });
      }

      return jsonOk(
        res,
        {
          plan
        }
      );
    } catch (error) {
      console.error(
        "DIRECTOR PLAN ERROR:",
        error
      );

      return jsonError(
        res,
        500,
        "Failed to build the Director plan.",
        {
          detail:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   GENERATE
========================================================= */

app.post(
  "/api/generate",
  async (
    req,
    res
  ) => {
    try {
      const {
        plan,

        testOnly =
          false
      } =
        req.body || {};

      if (
        !plan ||
        typeof plan !==
          "object"
      ) {
        return jsonError(
          res,
          400,
          "A valid Director plan is required."
        );
      }

      if (
        plan.ready ===
        false
      ) {
        return jsonError(
          res,
          422,
          "The Director plan is not ready.",
          {
            validation:
              plan.validation
          }
        );
      }

      /*
       * Demo mode NEVER submits a real GPU generation unless
       * explicitly using testOnly.
       */
      if (
        WORKER_MODE ===
          "demo" &&
        !Boolean(
          testOnly
        )
      ) {
        return jsonError(
          res,
          409,
          "AHM Studio is currently in DEMO worker mode. Run the test first or connect the production GPU worker before generating a real video.",
          {
            workerMode:
              WORKER_MODE,

            gpuSubmitted:
              false
          }
        );
      }

      if (
        !runPodConfigured()
      ) {
        return jsonError(
          res,
          503,
          "RunPod is not configured on the server.",
          {
            runpodConfigured:
              false,

            gpuSubmitted:
              false
          }
        );
      }

      const job =
        await submitRunPodJob({
          plan,

          testOnly:
            Boolean(
              testOnly
            )
        });

      const jobId =
        job.id ||
        job.job_id ||
        job.jobId;

      if (!jobId) {
        console.error(
          "RUNPOD RESPONSE:",
          job
        );

        return jsonError(
          res,
          502,
          "RunPod did not return a job ID.",
          {
            runpod:
              job
          }
        );
      }

      return jsonOk(
        res,
        {
          id:
            jobId,

          status:
            job.status ||
            "IN_QUEUE",

          testOnly:
            Boolean(
              testOnly
            ),

          workerMode:
            WORKER_MODE,

          gpuSubmitted:
            true
        }
      );
    } catch (
      error
    ) {
      console.error(
        "GENERATE ERROR:",
        error
      );

      return jsonError(
        res,
        error.status ===
          401
          ? 502
          : 500,
        "RunPod job submission failed.",
        {
          detail:
            error.message,

          runpod:
            error.data ||
            null,

          gpuSubmitted:
            false
        }
      );
    }
  }
);

/* =========================================================
   JOB STATUS
========================================================= */

app.get(
  "/api/job-status",
  async (
    req,
    res
  ) => {
    try {
      const id =
        String(
          req.query.id ||
            ""
        ).trim();

      if (!id) {
        return jsonError(
          res,
          400,
          "Job ID is required."
        );
      }

      const result =
        await getRunPodStatus(
          id
        );

      return jsonOk(
        res,
        {
          id,

          job:
            result
        }
      );
    } catch (
      error
    ) {
      console.error(
        "JOB STATUS ERROR:",
        error
      );

      return jsonError(
        res,
        error.status ===
          404
          ? 404
          : 500,
        "Unable to retrieve RunPod job status.",
        {
          detail:
            error.message,

          runpod:
            error.data ||
            null
        }
      );
    }
  }
);

/* =========================================================
   WORKER HEALTH
========================================================= */

app.get(
  "/api/worker-health",
  async (
    req,
    res
  ) => {
    try {
      if (
        !runPodConfigured()
      ) {
        return jsonOk(
          res,
          {
            configured:
              false,

            reachable:
              false,

            workerMode:
              WORKER_MODE
          }
        );
      }

      const health =
        await getRunPodHealth();

      return jsonOk(
        res,
        {
          configured:
            true,

          reachable:
            true,

          workerMode:
            WORKER_MODE,

          health
        }
      );
    } catch (
      error
    ) {
      return res
        .status(502)
        .json({
          ok:
            false,

          configured:
            runPodConfigured(),

          reachable:
            false,

          workerMode:
            WORKER_MODE,

          error:
            error.message,

          runpod:
            error.data ||
            null
        });
    }
  }
);

/* =========================================================
   PROJECTS LIST
========================================================= */

app.get(
  "/api/projects",
  (
    req,
    res
  ) => {
    try {
      return jsonOk(
        res,
        {
          projects:
            listProjects()
        }
      );
    } catch (
      error
    ) {
      console.error(
        "PROJECT LIST ERROR:",
        error
      );

      return jsonError(
        res,
        500,
        "Failed to list projects."
      );
    }
  }
);

/* =========================================================
   PROJECT SAVE
========================================================= */

app.post(
  "/api/projects",
  (
    req,
    res
  ) => {
    try {
      const project =
        req.body?.project ||
        req.body;

      if (
        !project ||
        typeof project !==
          "object"
      ) {
        return jsonError(
          res,
          400,
          "A project object is required."
        );
      }

      const saved =
        saveProject(
          project
        );

      return jsonOk(
        res,
        {
          project:
            saved
        }
      );
    } catch (
      error
    ) {
      console.error(
        "PROJECT SAVE ERROR:",
        error
      );

      return jsonError(
        res,
        500,
        "Failed to save project.",
        {
          detail:
            error.message
        }
      );
    }
  }
);

/* =========================================================
   PROJECT GET
========================================================= */

app.get(
  "/api/projects/:id",
  (
    req,
    res
  ) => {
    try {
      const id =
        sanitizeFilename(
          req.params.id
        );

      const project =
        readProject(
          id
        );

      if (!project) {
        return jsonError(
          res,
          404,
          "Project not found."
        );
      }

      return jsonOk(
        res,
        {
          project
        }
      );
    } catch (
      error
    ) {
      console.error(
        "PROJECT GET ERROR:",
        error
      );

      return jsonError(
        res,
        500,
        "Failed to read project."
      );
    }
  }
);

/* =========================================================
   SUBTITLES
========================================================= */

app.post(
  "/api/subtitles",
  (
    req,
    res
  ) => {
    try {
      const {
        plan
      } =
        req.body || {};

      if (
        !plan ||
        !Array.isArray(
          plan.scenes
        )
      ) {
        return jsonError(
          res,
          400,
          "A valid Director plan is required."
        );
      }

      const subtitles =
        buildSubtitles(
          plan.scenes
        );

      return jsonOk(
        res,
        {
          subtitles
        }
      );
    } catch (
      error
    ) {
      console.error(
        "SUBTITLE ERROR:",
        error
      );

      return jsonError(
        res,
        500,
        "Failed to build subtitles.",
        {
          detail:
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
  "/api",
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        ok:
          false,

        error:
          "API route not found."
      });
  }
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

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
    "*",
    (
      req,
      res,
      next
    ) => {
      if (
        req.path.startsWith(
          "/api/"
        )
      ) {
        return next();
      }

      const indexPath =
        path.join(
          PUBLIC_DIR,
          "index.html"
        );

      if (
        fs.existsSync(
          indexPath
        )
      ) {
        return res.sendFile(
          indexPath
        );
      }

      return next();
    }
  );
}

/* =========================================================
   FINAL 404
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        ok:
          false,

        error:
          "Resource not found."
      });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "UNHANDLED ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    return res
      .status(500)
      .json({
        ok:
          false,

        error:
          "Internal server error.",

        detail:
          error.message
      });
  }
);

/* =========================================================
   SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "=============================================="
    );

    console.log(
      `AHM STUDIO AI FILM DIRECTOR V${DIRECTOR_VERSION}`
    );

    console.log(
      "=============================================="
    );

    console.log(
      `Server listening on 0.0.0.0:${PORT}`
    );

    console.log(
      `Worker mode: ${WORKER_MODE}`
    );

    console.log(
      `RunPod configured: ${runPodConfigured()}`
    );

    console.log(
      `RunPod endpoint configured: ${Boolean(
        RUNPOD_ENDPOINT_ID
      )}`
    );

    console.log(
      `RunPod API key configured: ${Boolean(
        RUNPOD_API_KEY
      )}`
    );

    console.log(
      "=============================================="
    );
  }
);
