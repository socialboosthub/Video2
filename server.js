require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

/* =========================================================
   AHM STUDIO V8.1
   AI FILM DIRECTOR
   ---------------------------------------------------------
   Production responsibilities:
   - screenplay parsing
   - dialogue extraction
   - character continuity
   - duration allocation
   - balanced episode planning
   - cinematic shot planning
   - exact subtitle generation
   - RunPod submission/status/health
   ========================================================= */

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 10000);

const RUNPOD_API_KEY = String(process.env.RUNPOD_API_KEY || "").trim();
const RUNPOD_ENDPOINT_ID = String(
  process.env.RUNPOD_ENDPOINT_ID || ""
).trim();

const WORKER_MODE = String(
  process.env.AHM_WORKER_MODE || "demo"
)
  .trim()
  .toLowerCase();

const DIRECTOR_VERSION = "8.1";

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
   STARTUP DIRECTORIES
========================================================= */

fs.mkdirSync(PROJECTS_DIR, { recursive: true });

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

  return `${Date.now()}-${crypto
    .randomBytes(8)
    .toString("hex")}`;
}

function safeNumber(value, fallback) {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "")
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

function jsonError(res, status, message, extra = {}) {
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

function fileSizeBytes(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

function sanitizeFilename(value) {
  return String(value || "project")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

/* =========================================================
   SCREENPLAY NORMALIZATION
========================================================= */

function normalizeScreenplay(raw) {
  let text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ");

  /*
   * Normalize common smart punctuation without changing
   * the actual meaning or dialogue wording.
   */
  text = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u2014/g, "—")
    .replace(/\u2013/g, "–");

  return text.trim();
}

/* =========================================================
   SCENE DETECTION
========================================================= */

function isSceneHeading(line) {
  const value = cleanText(line);

  if (!value) return false;

  return /^SCENE\s+\d+\s*[—:-]/i.test(value);
}

function extractSceneNumber(line) {
  const match = cleanText(line).match(
    /^SCENE\s+(\d+)/i
  );

  return match ? Number(match[1]) : null;
}

function extractSceneTitle(line) {
  const value = cleanText(line);

  const match = value.match(
    /^SCENE\s+\d+\s*[—:-]\s*(.+)$/i
  );

  if (!match) {
    return value;
  }

  return cleanText(match[1]);
}

/* =========================================================
   DIALOGUE DETECTION
========================================================= */

/*
 * Supports:
 *
 * ELIAS:
 * "Hello."
 *
 * ELIAS: "Hello."
 *
 * MARA:
 * "Go back."
 *
 * GOLDEN FISH:
 * "I can speak."
 *
 * PEOPLE:
 * "Long live the Queen!"
 *
 * Speaker names may contain spaces.
 */

function parseDialogueFromLines(lines) {
  const dialogue = [];

  let currentSpeaker = null;
  let currentParts = [];

  function flush() {
    if (!currentSpeaker || currentParts.length === 0) {
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

  for (let i = 0; i < lines.length; i++) {
    const original = String(lines[i] || "");
    const line = cleanText(original);

    if (!line) {
      /*
       * Blank lines can separate dialogue blocks.
       * We flush only when already collecting dialogue.
       */
      if (currentSpeaker) {
        flush();
      }

      continue;
    }

    /*
     * Ignore markdown bullets before processing.
     */
    const withoutBullet = line
      .replace(/^[-*•]\s+/, "")
      .trim();

    /*
     * SPEAKER: dialogue on same line.
     *
     * Example:
     * MARA: "Elias!"
     */
    const sameLineMatch =
      withoutBullet.match(
        /^([A-Za-z][A-Za-z0-9 _.'-]{0,60})\s*:\s*(.+)$/u
      );

    if (sameLineMatch) {
      flush();

      const speaker = normalizeSpeaker(
        sameLineMatch[1]
      );

      let spoken = cleanDialogueText(
        sameLineMatch[2]
      );

      /*
       * Avoid interpreting labels such as LOCATION:
       * ACTION:
       * DIALOGUE:
       * as character dialogue.
       */
      const nonCharacterLabels = new Set([
        "LOCATION",
        "ACTION",
        "DIALOGUE",
        "DIALOGUE — LOCKED",
        "DIALOGUE - LOCKED",
        "STYLE",
        "MAIN CHARACTERS",
        "IMPORTANT",
        "CONTINUITY",
        "CHARACTERS",
        "CHARACTER",
        "VISUAL STYLE",
        "FORMAT",
        "TARGET LENGTH",
        "PARTS",
        "SUBTITLES"
      ]);

      if (nonCharacterLabels.has(speaker)) {
        continue;
      }

      /*
       * A colon with empty text means the next line contains
       * the dialogue.
       */
      currentSpeaker = speaker;

      if (spoken) {
        currentParts.push(spoken);
        flush();
      }

      continue;
    }

    /*
     * If we are already inside a dialogue block, collect
     * continuation lines until another speaker/heading/
     * structural label appears.
     */
    if (currentSpeaker) {
      const structural =
        /^(LOCATION|ACTION|DIALOGUE|STYLE|IMPORTANT|MAIN CHARACTERS|CHARACTERS|CHARACTER|SCENE)\b/i.test(
          withoutBullet
        );

      if (!structural) {
        currentParts.push(withoutBullet);
        continue;
      }

      flush();
    }
  }

  flush();

  return dialogue;
}

/* =========================================================
   DIALOGUE EXTRACTION FOR A SCENE
========================================================= */

function extractSceneDialogue(sceneLines) {
  return parseDialogueFromLines(sceneLines);
}

/* =========================================================
   ACTION EXTRACTION
========================================================= */

function removeDialogueFromAction(lines) {
  const actionLines = [];

  let collectingDialogue = false;

  for (let i = 0; i < lines.length; i++) {
    const line = cleanText(lines[i]);

    if (!line) {
      continue;
    }

    const normalized = line
      .replace(/^[-*•]\s+/, "")
      .trim();

    /*
     * SPEAKER: text
     */
    const sameLineDialogue =
      normalized.match(
        /^([A-Za-z][A-Za-z0-9 _.'-]{0,60})\s*:\s*(.+)$/u
      );

    if (sameLineDialogue) {
      const speaker = normalizeSpeaker(
        sameLineDialogue[1]
      );

      const nonCharacterLabels = new Set([
        "LOCATION",
        "ACTION",
        "DIALOGUE",
        "DIALOGUE — LOCKED",
        "DIALOGUE - LOCKED",
        "STYLE",
        "MAIN CHARACTERS",
        "IMPORTANT",
        "CHARACTERS",
        "CHARACTER"
      ]);

      if (!nonCharacterLabels.has(speaker)) {
        collectingDialogue = true;
        continue;
      }
    }

    /*
     * Standalone structural labels.
     */
    if (
      /^(LOCATION|ACTION|DIALOGUE|DIALOGUE — LOCKED|DIALOGUE - LOCKED)$/i.test(
        normalized
      )
    ) {
      collectingDialogue = false;
      continue;
    }

    /*
     * Quoted continuation after SPEAKER:
     */
    if (collectingDialogue) {
      /*
       * A new sentence without a speaker can still be a
       * continuation of dialogue. Keep it out of action.
       */
      if (
        /^["“]/.test(normalized) ||
        /["”]$/.test(normalized)
      ) {
        continue;
      }

      /*
       * If it looks like another prose/action sentence,
       * end dialogue mode.
       */
      if (
        /^(He|She|They|It|Elias|Mara|The fish|The ocean|The sky|A |An |Their |Everything|Mara's|Elias's)\b/i.test(
          normalized
        )
      ) {
        collectingDialogue = false;
      } else {
        continue;
      }
    }

    actionLines.push(normalized);
  }

  return actionLines;
}

/* =========================================================
   LOCATION EXTRACTION
========================================================= */

function extractLocation(lines) {
  for (const raw of lines) {
    const line = cleanText(raw);

    if (!line) continue;

    const match = line.match(
      /^LOCATION\s*:\s*(.+)$/i
    );

    if (match) {
      return cleanText(match[1]);
    }
  }

  return "";
}

/* =========================================================
   ACTION CLEANUP
========================================================= */

function buildActionText(lines, dialogue) {
  const dialogueTexts = new Set(
    dialogue.map((item) => cleanDialogueText(item.text))
  );

  const cleaned = [];

  for (const raw of lines) {
    let line = cleanText(raw);

    if (!line) continue;

    /*
     * Remove structural labels.
     */
    if (
      /^(LOCATION|ACTION|DIALOGUE|DIALOGUE — LOCKED|DIALOGUE - LOCKED)$/i.test(
        line
      )
    ) {
      continue;
    }

    /*
     * Remove exact dialogue lines accidentally duplicated
     * inside the action area.
     */
    const sameLineMatch =
      line.match(
        /^([A-Za-z][A-Za-z0-9 _.'-]{0,60})\s*:\s*(.+)$/u
      );

    if (sameLineMatch) {
      const text = cleanDialogueText(
        sameLineMatch[2]
      );

      if (dialogueTexts.has(text)) {
        continue;
      }
    }

    if (dialogueTexts.has(cleanDialogueText(line))) {
      continue;
    }

    cleaned.push(line);
  }

  return cleaned.join(" ").trim();
}

/* =========================================================
   SCENE PARSER
========================================================= */

function parseScenes(screenplay) {
  const normalized = normalizeScreenplay(screenplay);

  const lines = normalized.split("\n");

  const scenes = [];

  let current = null;

  function flushScene() {
    if (!current) return;

    const allLines = current.lines.slice();

    const location =
      extractLocation(allLines);

    const dialogue =
      extractSceneDialogue(allLines);

    const actionLines =
      removeDialogueFromAction(allLines);

    const action =
      buildActionText(
        actionLines,
        dialogue
      );

    current.location = location;
    current.dialogue = dialogue;
    current.action = action;

    /*
     * Scene fallback:
     * If no explicit ACTION block exists, preserve prose
     * as action instead of losing it.
     */
    if (!current.action) {
      const fallback = allLines
        .filter((line) => {
          const value = cleanText(line);

          if (!value) return false;

          if (/^LOCATION\s*:/i.test(value)) {
            return false;
          }

          if (
            /^(DIALOGUE|ACTION|DIALOGUE — LOCKED|DIALOGUE - LOCKED)$/i.test(
              value
            )
          ) {
            return false;
          }

          return true;
        })
        .join(" ")
        .trim();

      current.action = fallback;
    }

    scenes.push({
      number: current.number,
      title: current.title,
      location: current.location,
      action: current.action,
      dialogue: current.dialogue,
      raw: allLines
    });

    current = null;
  }

  for (const rawLine of lines) {
    const line = cleanText(rawLine);

    if (!line) {
      if (current) {
        current.lines.push("");
      }
      continue;
    }

    if (isSceneHeading(line)) {
      flushScene();

      current = {
        number: extractSceneNumber(line),
        title: extractSceneTitle(line),
        lines: []
      };

      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  flushScene();

  return scenes;
}

/* =========================================================
   CHARACTER EXTRACTION
========================================================= */

function extractCharacters(screenplay) {
  const text = normalizeScreenplay(screenplay);

  const result = [];

  const knownNames = [
    "ELIAS",
    "MARA",
    "GOLDEN FISH",
    "PEOPLE"
  ];

  for (const name of knownNames) {
    const regex = new RegExp(
      `^\\s*-?\\s*${name.replace(
        " ",
        "\\s+"
      )}\\s*:\\s*(.+)$`,
      "im"
    );

    const match = text.match(regex);

    if (match) {
      result.push({
        name,
        description: cleanText(match[1])
      });
    }
  }

  return result;
}

/* =========================================================
   WORD COUNT
========================================================= */

function countWords(text) {
  return normalizeScreenplay(text)
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/* =========================================================
   DIALOGUE COUNT
========================================================= */

function countDialogueLines(scenes) {
  return scenes.reduce(
    (total, scene) =>
      total + scene.dialogue.length,
    0
  );
}

/* =========================================================
   DIALOGUE WORD COUNT
========================================================= */

function countDialogueWords(scenes) {
  return scenes.reduce(
    (total, scene) =>
      total +
      scene.dialogue.reduce(
        (sum, line) =>
          sum + countWords(line.text),
        0
      ),
    0
  );
}

/* =========================================================
   RAW SCENE DURATION ESTIMATION
========================================================= */

function estimateSceneSeconds(scene) {
  const actionWords = countWords(
    scene.action
  );

  const dialogueWords = scene.dialogue.reduce(
    (sum, line) =>
      sum + countWords(line.text),
    0
  );

  /*
   * Dialogue is naturally slower than silent action.
   */
  const actionSeconds =
    actionWords / 2.8;

  const dialogueSeconds =
    dialogueWords / 2.15;

  /*
   * Every scene gets enough time for cinematic breathing
   * room and transitions.
   */
  const baseline = 7;

  const raw =
    baseline +
    actionSeconds +
    dialogueSeconds;

  return clamp(
    raw,
    8,
    60
  );
}

/* =========================================================
   TARGET DURATION
========================================================= */

function getTargetDuration(body) {
  const value = safeNumber(
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
   EXACT DURATION ALLOCATION
========================================================= */

function allocateSceneDurations(
  scenes,
  targetSeconds
) {
  if (!scenes.length) return [];

  const minimumPerScene = 8;

  const minimumTotal =
    minimumPerScene * scenes.length;

  let effectiveTarget =
    Math.max(
      targetSeconds,
      minimumTotal
    );

  const rawDurations = scenes.map(
    estimateSceneSeconds
  );

  const rawTotal = rawDurations.reduce(
    (sum, value) => sum + value,
    0
  );

  /*
   * First allocation.
   */
  let durations = rawDurations.map(
    (raw) =>
      Math.max(
        minimumPerScene,
        (raw / rawTotal) *
          effectiveTarget
      )
  );

  /*
   * Normalize to exact target.
   */
  let currentTotal = durations.reduce(
    (sum, value) => sum + value,
    0
  );

  let difference =
    effectiveTarget - currentTotal;

  /*
   * Iteratively distribute difference while respecting
   * the scene minimum.
   */
  for (let pass = 0; pass < 10 && Math.abs(difference) > 0.01; pass++) {
    const adjustableIndexes = [];

    for (let i = 0; i < durations.length; i++) {
      if (
        difference > 0 ||
        durations[i] > minimumPerScene + 0.01
      ) {
        adjustableIndexes.push(i);
      }
    }

    if (!adjustableIndexes.length) break;

    const share =
      difference /
      adjustableIndexes.length;

    for (const index of adjustableIndexes) {
      const next =
        durations[index] + share;

      durations[index] =
        Math.max(
          minimumPerScene,
          next
        );
    }

    currentTotal = durations.reduce(
      (sum, value) => sum + value,
      0
    );

    difference =
      effectiveTarget - currentTotal;
  }

  /*
   * Convert to whole seconds while guaranteeing the exact
   * total.
   */
  let integerDurations =
    durations.map((value) =>
      Math.max(
        minimumPerScene,
        Math.floor(value)
      )
    );

  let integerTotal =
    integerDurations.reduce(
      (sum, value) => sum + value,
      0
    );

  let remaining =
    effectiveTarget - integerTotal;

  /*
   * Give leftover seconds to the scenes with the largest
   * fractional portions.
   */
  const fractions =
    durations
      .map((value, index) => ({
        index,
        fraction:
          value - Math.floor(value)
      }))
      .sort(
        (a, b) =>
          b.fraction - a.fraction
      );

  let cursor = 0;

  while (remaining > 0) {
    const item =
      fractions[cursor % fractions.length];

    integerDurations[item.index] += 1;

    remaining -= 1;
    cursor += 1;
  }

  /*
   * If somehow rounding pushed the total over target,
   * remove seconds only from scenes above minimum.
   */
  while (remaining < 0) {
    let changed = false;

    for (let i = integerDurations.length - 1; i >= 0; i--) {
      if (
        integerDurations[i] >
        minimumPerScene
      ) {
        integerDurations[i] -= 1;
        remaining += 1;
        changed = true;

        if (remaining === 0) break;
      }
    }

    if (!changed) break;
  }

  return integerDurations;
}

/* =========================================================
   BALANCED EPISODE SPLITTING
========================================================= */

function splitScenesIntoParts(
  scenes,
  partCount
) {
  if (!scenes.length) return [];

  const count = clamp(
    round(partCount || 1),
    1,
    scenes.length
  );

  if (count === 1) {
    return [
      scenes.slice()
    ];
  }

  /*
   * Dynamic programming finds the scene boundaries that
   * make the parts as balanced as possible while NEVER
   * splitting a scene.
   */
  const n = scenes.length;

  const prefix = [0];

  for (const scene of scenes) {
    prefix.push(
      prefix[prefix.length - 1] +
        scene.duration
    );
  }

  const target =
    prefix[n] / count;

  const dp = Array.from(
    { length: count + 1 },
    () =>
      Array(n + 1).fill(Infinity)
  );

  const cut = Array.from(
    { length: count + 1 },
    () =>
      Array(n + 1).fill(-1)
  );

  dp[0][0] = 0;

  for (let parts = 1; parts <= count; parts++) {
    for (
      let end = parts;
      end <= n;
      end++
    ) {
      for (
        let start = parts - 1;
        start < end;
        start++
      ) {
        if (
          !Number.isFinite(
            dp[parts - 1][start]
          )
        ) {
          continue;
        }

        const duration =
          prefix[end] -
          prefix[start];

        const cost =
          Math.pow(
            duration - target,
            2
          );

        const candidate =
          dp[parts - 1][start] +
          cost;

        if (
          candidate <
          dp[parts][end]
        ) {
          dp[parts][end] =
            candidate;

          cut[parts][end] =
            start;
        }
      }
    }
  }

  const groups = [];

  let end = n;

  for (
    let parts = count;
    parts >= 1;
    parts--
  ) {
    const start =
      cut[parts][end];

    if (start < 0) {
      return fallbackSplitScenes(
        scenes,
        count
      );
    }

    groups.unshift(
      scenes.slice(start, end)
    );

    end = start;
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
      scenes.length - start;

    const remainingParts =
      partCount - part;

    const take = Math.ceil(
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
   SHOT TYPE SELECTION
========================================================= */

function chooseShotType(
  index,
  total,
  hasDialogue,
  dialogueSpeaker
) {
  if (index === 0) {
    return "ESTABLISHING";
  }

  if (
    hasDialogue &&
    dialogueSpeaker
  ) {
    return "MEDIUM / DIALOGUE";
  }

  if (index === total - 1) {
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
    index % cycle.length
  ];
}

/* =========================================================
   ACTION SENTENCE SPLITTING
========================================================= */

function splitActionSentences(action) {
  const text = cleanText(action);

  if (!text) return [];

  /*
   * Preserve sentences as much as possible.
   */
  const matches =
    text.match(
      /[^.!?]+(?:[.!?]+|$)/g
    );

  if (!matches) {
    return [text];
  }

  return matches
    .map((item) =>
      cleanText(item)
    )
    .filter(Boolean);
}

/* =========================================================
   SHOT DURATION ALLOCATION
========================================================= */

function allocateShotDurations(
  shotCount,
  totalSeconds
) {
  if (shotCount <= 0) return [];

  const minimum = 2;

  if (
    totalSeconds <
    shotCount * minimum
  ) {
    /*
     * In an impossible situation, spread available time
     * as evenly as possible.
     */
    const result =
      Array(shotCount).fill(
        Math.max(
          1,
          Math.floor(
            totalSeconds /
              shotCount
          )
        )
      );

    let used = result.reduce(
      (a, b) => a + b,
      0
    );

    let left =
      Math.max(
        0,
        totalSeconds - used
      );

    let i = 0;

    while (left > 0) {
      result[i % result.length] += 1;
      left -= 1;
      i += 1;
    }

    return result;
  }

  const base =
    Math.floor(
      totalSeconds / shotCount
    );

  const result =
    Array(shotCount).fill(
      Math.max(minimum, base)
    );

  let used = result.reduce(
    (a, b) => a + b,
    0
  );

  let difference =
    totalSeconds - used;

  let index = 0;

  while (difference > 0) {
    result[index % shotCount] += 1;
    difference -= 1;
    index += 1;
  }

  while (difference < 0) {
    const candidate =
      index % shotCount;

    if (
      result[candidate] >
      minimum
    ) {
      result[candidate] -= 1;
      difference += 1;
    }

    index += 1;

    if (index > shotCount * 10) {
      break;
    }
  }

  return result;
}

/* =========================================================
   CINEMATIC SHOT PLANNER
========================================================= */

function makeShots(scene) {
  const actionSentences =
    splitActionSentences(
      scene.action
    );

  const dialogue =
    scene.dialogue || [];

  const units = [];

  /*
   * Establishing action.
   */
  if (scene.location) {
    units.push({
      kind: "action",
      text:
        scene.location
    });
  }

  /*
   * Action units.
   */
  for (const sentence of actionSentences) {
    units.push({
      kind: "action",
      text: sentence
    });
  }

  /*
   * Dialogue units.
   */
  for (const line of dialogue) {
    units.push({
      kind: "dialogue",
      speaker: line.speaker,
      text: line.text,
      dialogueId: line.id
    });
  }

  /*
   * If nothing was extracted, create a single controlled
   * scene shot rather than silently losing the scene.
   */
  if (!units.length) {
    units.push({
      kind: "action",
      text:
        scene.title ||
        "Cinematic scene action."
    });
  }

  /*
   * Avoid excessive micro-shots. Merge action units when
   * the screenplay has huge amounts of prose.
   */
  const maxShots = clamp(
    2 +
      dialogue.length * 2 +
      Math.ceil(
        actionSentences.length / 2
      ),
    3,
    16
  );

  let selected = units;

  if (units.length > maxShots) {
    const reduced = [];

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];

      if (
        reduced.length >= maxShots
      ) {
        const last =
          reduced[reduced.length - 1];

        last.text =
          `${last.text} ${unit.text}`.trim();

        continue;
      }

      reduced.push({
        ...unit
      });
    }

    selected = reduced;
  }

  /*
   * Ensure every dialogue line gets its own shot.
   * This is critical for lip-sync and exact subtitles.
   */
  const dialogueUnits =
    selected.filter(
      (unit) =>
        unit.kind === "dialogue"
    );

  const actionUnits =
    selected.filter(
      (unit) =>
        unit.kind === "action"
    );

  const ordered = [];

  /*
   * Preserve story order using the original units whenever
   * possible.
   */
  for (const unit of selected) {
    ordered.push(unit);
  }

  const durations =
    allocateShotDurations(
      ordered.length,
      scene.duration
    );

  return ordered.map(
    (unit, index) => {
      const type =
        chooseShotType(
          index,
          ordered.length,
          unit.kind === "dialogue",
          unit.speaker
        );

      return {
        id: makeId(),
        scene: scene.number,
        shot: index + 1,
        type,
        duration: durations[index],
        speaker:
          unit.kind === "dialogue"
            ? unit.speaker
            : null,
        dialogueId:
          unit.kind === "dialogue"
            ? unit.dialogueId
            : null,
        action:
          unit.kind === "dialogue"
            ? `Character speaks naturally while maintaining continuity and emotion: ${unit.text}`
            : unit.text,
        dialogue:
          unit.kind === "dialogue"
            ? unit.text
            : null,
        visualPrompt: buildVisualPrompt(
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
    "Maintain exact character identity, age, face, hair, wardrobe, props, geography, lighting continuity and chronological story state. Do not invent story events.";

  if (unit.kind === "dialogue") {
    return [
      `Live-action cinematic ${shotType.toLowerCase()} shot.`,
      `Location: ${location}.`,
      `Speaker: ${unit.speaker}.`,
      `Performance: naturally deliver the exact scripted dialogue with accurate lip movement and emotion.`,
      `Exact dialogue: "${unit.text}"`,
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

    if (!dialogue.length) {
      cursor += scene.duration;
      continue;
    }

    /*
     * Dialogue timing is weighted by word count.
     */
    const weights =
      dialogue.map((line) =>
        Math.max(
          1,
          countWords(line.text)
        )
      );

    const totalWeight =
      weights.reduce(
        (a, b) => a + b,
        0
      );

    let localCursor = cursor;

    for (
      let i = 0;
      i < dialogue.length;
      i++
    ) {
      const line =
        dialogue[i];

      const share =
        scene.duration *
        (weights[i] /
          totalWeight);

      const start =
        round(localCursor * 1000) /
        1000;

      const end =
        round(
          (localCursor + share) *
            1000
        ) / 1000;

      subtitles.push({
        id: line.id,
        scene: scene.number,
        speaker: line.speaker,
        text: line.text,
        start,
        end
      });

      localCursor += share;
    }

    cursor += scene.duration;
  }

  return subtitles;
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
            sum + scene.duration,
          0
        );

      const shots =
        group.flatMap(
          (scene) =>
            scene.shots
        );

      return {
        part: index + 1,
        duration,
        scenes: group.map(
          (scene) =>
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

function validatePlan(plan) {
  const errors = [];
  const warnings = [];

  if (!plan.scenes.length) {
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

  if (
    plan.dialogueLines === 0 &&
    plan.screenplayContainsSpeakerLabels
  ) {
    errors.push(
      "Speaker labels were detected in the screenplay but no dialogue lines were extracted."
    );
  }

  if (
    plan.dialogueLines >
    0 &&
    plan.subtitles.length === 0
  ) {
    errors.push(
      "Dialogue was extracted but subtitle generation returned zero entries."
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

  if (
    plan.dialogueLines >
    0 &&
    plan.dialogueShots <
      plan.dialogueLines
  ) {
    errors.push(
      "Every dialogue line must have at least one dedicated dialogue shot."
    );
  }

  const durationDifference =
    plan.plannedSeconds -
    plan.targetSeconds;

  if (
    Math.abs(durationDifference) >
    2
  ) {
    warnings.push(
      `Planned duration differs from target by ${durationDifference}s.`
    );
  }

  if (
    plan.scenes.some(
      (scene) =>
        !scene.location
    )
  ) {
    warnings.push(
      "One or more scenes have no explicit LOCATION. Continuity will use the available scene action."
    );
  }

  if (
    plan.scenes.some(
      (scene) =>
        !scene.action &&
        scene.dialogue.length === 0
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

  const screenplayContainsSpeakerLabels =
    /^(ELIAS|MARA|GOLDEN FISH|PEOPLE)\s*:/im.test(
      normalized
    );

  /*
   * Allocate exact target duration.
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

        const nextScene = {
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
            nextScene
          );

        return {
          ...nextScene,
          shots
        };
      }
    );

  /*
   * Rebalance shot durations if a scene's shot count
   * requires it.
   */
  for (const scene of finalScenes) {
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
        sum + scene.shots.length,
      0
    );

  const dialogueShots =
    finalScenes.reduce(
      (sum, scene) =>
        sum +
        scene.shots.filter(
          (shot) =>
            Boolean(
              shot.dialogue
            )
        ).length,
      0
    );

  const plannedSeconds =
    finalScenes.reduce(
      (sum, scene) =>
        sum + scene.duration,
      0
    );

  const plan = {
    id: makeId(),
    directorVersion:
      DIRECTOR_VERSION,

    createdAt:
      new Date().toISOString(),

    format:
      ALLOWED_FORMATS.has(format)
        ? format
        : "9:16",

    targetSeconds:
      round(targetSeconds),

    plannedSeconds:
      round(plannedSeconds),

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
      "Wardrobe remains locked unless the screenplay explicitly changes it.",
      "Props remain locked unless the screenplay explicitly changes them.",
      "Geography remains locked.",
      "Chronological story events remain locked.",
      "No invented story events.",
      "No narrator unless explicitly scripted."
    ],

    screenplayWords:
      countWords(normalized),

    dialogueLines,

    dialogueWords,

    dialogueShots,

    gpuShots,

    screenplayContainsSpeakerLabels,

    characters,

    scenes: finalScenes,

    parts: actualParts,

    subtitles: subtitlesData
  };

  const validation =
    validatePlan(plan);

  plan.validation =
    validation;

  plan.ready =
    validation.errors.length === 0;

  return plan;
}

/* =========================================================
   RUNPOD HELPERS
========================================================= */

function runPodConfigured() {
  return Boolean(
    RUNPOD_API_KEY &&
      RUNPOD_ENDPOINT_ID
  );
}

function runPodBaseUrl() {
  return `https://api.runpod.ai/v2/${encodeURIComponent(
    RUNPOD_ENDPOINT_ID
  )}`;
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

  let data = null;

  try {
    data =
      text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    const error =
      new Error(
        `HTTP ${response.status}`
      );

    error.status =
      response.status;

    error.data = data;

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
  if (!runPodConfigured()) {
    throw new Error(
      "RunPod is not configured. Add RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID on the server before submitting a GPU job."
    );
  }

  const payload = {
    input: {
      job_type:
        "ahm_video_project",

      director_version:
        DIRECTOR_VERSION,

      test_only:
        Boolean(testOnly),

      project:
        plan
    }
  };

  return fetchJson(
    `${runPodBaseUrl()}/run`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type":
          "application/json"
      },
      body:
        JSON.stringify(payload)
    }
  );
}

/* =========================================================
   RUNPOD STATUS
========================================================= */

async function getRunPodStatus(
  jobId
) {
  if (!runPodConfigured()) {
    throw new Error(
      "RunPod is not configured."
    );
  }

  return fetchJson(
    `${runPodBaseUrl()}/status/${encodeURIComponent(
      jobId
    )}`,
    {
      method: "GET",
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
  if (!runPodConfigured()) {
    throw new Error(
      "RunPod is not configured."
    );
  }

  return fetchJson(
    `${runPodBaseUrl()}/health`,
    {
      method: "GET",
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

function projectPath(id) {
  return path.join(
    PROJECTS_DIR,
    `${sanitizeFilename(id)}.json`
  );
}

function saveProject(project) {
  const id =
    project.id || makeId();

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
    fileSizeBytes(serialized) >
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

function readProject(id) {
  const filename =
    projectPath(id);

  if (
    !fs.existsSync(filename)
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
    .readdirSync(PROJECTS_DIR)
    .filter(
      (name) =>
        name.endsWith(".json")
    )
    .map((name) => {
      try {
        const full =
          path.join(
            PROJECTS_DIR,
            name
          );

        return JSON.parse(
          fs.readFileSync(
            full,
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
          b.savedAt || ""
        ).localeCompare(
          String(
            a.savedAt || ""
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
    return jsonOk(res, {
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
    });
  }
);

/* =========================================================
   SETTINGS
========================================================= */

app.get(
  "/api/settings",
  (req, res) => {
    return jsonOk(res, {
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
    });
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
        format = "9:16",
        targetLength = 240,
        parts = 6,
        subtitles = true,
        narrator = false
      } = req.body || {};

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

      if (
        !plan.ready
      ) {
        return res.status(422).json({
          ok: false,
          error:
            "Director plan validation failed.",
          plan
        });
      }

      return jsonOk(res, {
        plan
      });
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
  async (req, res) => {
    try {
      const {
        plan,
        testOnly = false
      } = req.body || {};

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
        plan.ready === false
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
       * DEMO MODE SAFETY:
       *
       * A demo worker may be used for connection testing,
       * but it must never be presented as real video
       * generation.
       */
      if (
        WORKER_MODE === "demo" &&
        !Boolean(testOnly)
      ) {
        return jsonError(
          res,
          409,
          "AHM Studio is currently in DEMO worker mode. Run Test RunPod first, or connect the production GPU worker before generating a real video.",
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
            Boolean(testOnly)
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

      return jsonOk(res, {
        id: jobId,
        status:
          job.status ||
          "IN_QUEUE",
        testOnly:
          Boolean(testOnly),
        workerMode:
          WORKER_MODE,
        gpuSubmitted:
          true
      });
    } catch (error) {
      console.error(
        "GENERATE ERROR:",
        error
      );

      return jsonError(
        res,
        error.status === 401
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
  async (req, res) => {
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

      return jsonOk(res, {
        id,
        job: result
      });
    } catch (error) {
      console.error(
        "JOB STATUS ERROR:",
        error
      );

      return jsonError(
        res,
        error.status === 404
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
  async (req, res) => {
    try {
      if (
        !runPodConfigured()
      ) {
        return jsonOk(res, {
          configured:
            false,
          reachable:
            false,
          workerMode:
            WORKER_MODE
        });
      }

      const health =
        await getRunPodHealth();

      return jsonOk(res, {
        configured:
          true,
        reachable:
          true,
        workerMode:
          WORKER_MODE,
        health
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
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
   PROJECTS - LIST
========================================================= */

app.get(
  "/api/projects",
  (req, res) => {
    try {
      return jsonOk(res, {
        projects:
          listProjects()
      });
    } catch (error) {
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
   PROJECTS - SAVE
========================================================= */

app.post(
  "/api/projects",
  (req, res) => {
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
        saveProject(project);

      return jsonOk(res, {
        project:
          saved
      });
    } catch (error) {
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
   PROJECT - GET
========================================================= */

app.get(
  "/api/projects/:id",
  (req, res) => {
    try {
      const id =
        sanitizeFilename(
          req.params.id
        );

      const project =
        readProject(id);

      if (!project) {
        return jsonError(
          res,
          404,
          "Project not found."
        );
      }

      return jsonOk(res, {
        project
      });
    } catch (error) {
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
  (req, res) => {
    try {
      const {
        plan
      } = req.body || {};

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

      return jsonOk(res, {
        subtitles
      });
    } catch (error) {
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
  (req, res) => {
    return res.status(404).json({
      ok: false,
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
    (req, res, next) => {
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
        fs.existsSync(indexPath)
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
  (req, res) => {
    return res.status(404).json({
      ok: false,
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
      return next(error);
    }

    return res.status(500).json({
      ok: false,
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
