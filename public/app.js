const $ = s => document.querySelector(s);

let plan = null;

let chars = JSON.parse(
  localStorage.getItem("ahm_chars_v80") || "[]"
);

const GOLDEN = `THE GOLDEN FISH

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

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m])
  );
}

function wordCount() {
  const words =
    ($("#screenplay").value.trim().match(/\S+/g) || [])
      .length;

  $("#wordBadge").textContent =
    `${words} words`;
}

function apiError(r, d) {
  return (
    d?.error ||
    `Request failed (${r.status}).`
  );
}

async function jsonFetch(url, opt = {}) {
  const r = await fetch(url, opt);

  const t = await r.text();

  let d;

  try {
    d = JSON.parse(t);
  } catch {
    throw new Error(
      `Server returned non-JSON (${r.status}). ${t.slice(
        0,
        300
      )}`
    );
  }

  if (!r.ok) {
    throw new Error(
      apiError(r, d)
    );
  }

  return d;
}

function setStatus(text, bad = false) {
  $("#directorStatus").textContent =
    text;

  $("#directorStatus").className =
    bad
      ? "status bad"
      : "status";
}

async function refreshHealth() {
  try {
    const d =
      await jsonFetch(
        "/api/health"
      );

    const ready =
      d.runpodConfigured;

    $("#systemStatus").innerHTML =
      `<i></i> ${
        ready
          ? "RunPod Ready"
          : "Director Ready"
      }`;

    $("#systemStatus").style.color =
      "";
  } catch (e) {
    $("#systemStatus").innerHTML =
      "<i></i> Offline";

    $("#systemStatus").style.color =
      "var(--danger)";
  }
}

async function refreshSettings() {
  try {
    const s =
      await jsonFetch(
        "/api/settings"
      );

    $("#setupBox").innerHTML = `
      <p>
        <b>Server status:</b>
        ${esc(s.environment)}
      </p>

      <p>
        <b>RunPod API key:</b>
        ${
          s.hasApiKey
            ? "<span class='good'>Configured</span>"
            : "<span class='bad'>Missing</span>"
        }
      </p>

      <p>
        <b>Endpoint ID:</b>
        ${
          s.hasEndpoint
            ? "<span class='good'>Configured</span>"
            : "<span class='bad'>Missing</span>"
        }
      </p>

      <p>
        <b>Worker mode:</b>
        <code>${esc(
          s.workerMode
        )}</code>
      </p>

      <hr>

      <b>For Render:</b>

      <ol>
        <li>
          Open your Render service →
          <b>Environment</b>.
        </li>

        <li>
          Add
          <code>RUNPOD_API_KEY</code>.
        </li>

        <li>
          Add
          <code>RUNPOD_ENDPOINT_ID</code>.
        </li>

        <li>
          For the free local contract test use
          <code>AHM_WORKER_MODE=demo</code>.
        </li>

        <li>
          Redeploy after saving variables.
        </li>
      </ol>

      <p class="hint">
        The secret is intentionally never accepted
        by this browser page.
      </p>
    `;
  } catch (e) {
    $("#setupBox").innerHTML =
      `<p class="bad">${esc(
        e.message
      )}</p>`;
  }
}

$("#screenplay").addEventListener(
  "input",
  wordCount
);

$("#loadTest").onclick = () => {
  $("#screenplay").value =
    GOLDEN;

  wordCount();

  $("#scriptStatus").textContent =
    "Golden Fish test loaded. Build the plan — no GPU request.";
};

$("#clearScript").onclick = () => {
  $("#screenplay").value =
    "";

  plan = null;

  wordCount();

  $("#planView")
    .classList
    .add("hidden");

  $("#generationView")
    .classList
    .add("hidden");

  $("#generate").disabled =
    true;

  setStatus(
    "Ready."
  );
};

$("#newBtn").onclick = () => {
  $("#clearScript").click();

  scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

$("#healthBtn").onclick =
  refreshHealth;

$("#settingsBtn").onclick =
  async () => {
    $("#settingsModal")
      .classList
      .remove("hidden");

    await refreshSettings();
  };

$("#refreshSettings").onclick =
  refreshSettings;

$("#closeSettings").onclick =
  () =>
    $("#settingsModal")
      .classList
      .add("hidden");

$("#closeChar").onclick =
  () =>
    $("#charModal")
      .classList
      .add("hidden");

function renderChars() {
  const box =
    $("#chars");

  box.innerHTML = "";

  if (!chars.length) {
    box.innerHTML =
      '<div class="muted">No saved characters yet.</div>';

    return;
  }

  for (const c of chars) {
    const d =
      document.createElement(
        "div"
      );

    d.className =
      "char";

    d.innerHTML = `
      <h3>${esc(
        c.name
      )}</h3>

      <p>
        <b>${esc(
          c.role || ""
        )}</b>
      </p>

      <p>${esc(
        c.look || ""
      )}</p>

      <div class="mini">

        <button
          class="secondary"
          data-edit="${esc(
            c.id
          )}"
        >
          Edit
        </button>

        <button
          class="secondary danger"
          data-del="${esc(
            c.id
          )}"
        >
          Delete
        </button>

      </div>
    `;

    box.appendChild(d);
  }

  box
    .querySelectorAll(
      "[data-edit]"
    )
    .forEach(
      b =>
        (b.onclick = () =>
          editChar(
            b.dataset.edit
          ))
    );

  box
    .querySelectorAll(
      "[data-del]"
    )
    .forEach(
      b =>
        (b.onclick = () => {
          chars =
            chars.filter(
              c =>
                c.id !==
                b.dataset.del
            );

          localStorage.setItem(
            "ahm_chars_v80",
            JSON.stringify(
              chars
            )
          );

          renderChars();
        })
    );
}

function editChar(id) {
  const c =
    chars.find(
      x => x.id === id
    );

  if (!c) return;

  $("#charId").value =
    c.id;

  $("#cName").value =
    c.name || "";

  $("#cRole").value =
    c.role || "";

  $("#cLook").value =
    c.look || "";

  $("#cPersonality").value =
    c.personality || "";

  $("#cVoice").value =
    c.voice || "";

  $("#charTitle").textContent =
    "Edit Character";

  $("#charModal")
    .classList
    .remove("hidden");
}

$("#addChar").onclick = () => {
  [
    "charId",
    "cName",
    "cRole",
    "cLook",
    "cPersonality",
    "cVoice"
  ].forEach(
    x =>
      ($("#" + x).value =
        "")
  );

  $("#charTitle").textContent =
    "Add Character";

  $("#charModal")
    .classList
    .remove("hidden");
};

$("#saveChar").onclick = () => {
  const name =
    $("#cName")
      .value
      .trim();

  if (!name) {
    alert(
      "Character name is required."
    );

    return;
  }

  const cid =
    $("#charId").value ||
    (
      crypto.randomUUID
        ? crypto.randomUUID()
        : `char_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`
    );

  const c = {
    id: cid,

    name,

    role:
      $("#cRole")
        .value
        .trim(),

    look:
      $("#cLook")
        .value
        .trim(),

    personality:
      $("#cPersonality")
        .value
        .trim(),

    voice:
      $("#cVoice")
        .value
        .trim()
  };

  const i =
    chars.findIndex(
      x => x.id === cid
    );

  if (i >= 0) {
    chars[i] = c;
  } else {
    chars.push(c);
  }

  localStorage.setItem(
    "ahm_chars_v80",
    JSON.stringify(
      chars
    )
  );

  renderChars();

  $("#charModal")
    .classList
    .add("hidden");
};

function renderPlan(p) {
  if (!p) {
    throw new Error(
      "Director returned an empty plan."
    );
  }

  const validation =
    p.validation || {};

  const scenes =
    Array.isArray(
      p.scenes
    )
      ? p.scenes
      : [];

  const parts =
    Array.isArray(
      p.parts
    )
      ? p.parts
      : Array.isArray(
          p.episodes
        )
        ? p.episodes
        : [];

  const explicitScenes =
    validation.explicitScenes ??
    scenes.length;

  const actualEpisodes =
    validation.actualEpisodes ??
    p.partsActual ??
    parts.length;

  const dialogueLines =
    validation.dialogueLines ??
    p.dialogueLines ??
    0;

  const gpuShots =
    validation.gpuShots ??
    validation.shots ??
    p.gpuShots ??
    0;

  let h = `
    <div class="plan-meta">

      <div class="pill">
        ${explicitScenes}
        scenes locked
      </div>

      <div class="pill">
        ${actualEpisodes}
        parts
      </div>

      <div class="pill">
        ${dialogueLines}
        dialogue lines
      </div>

      <div class="pill">
        ${gpuShots}
        GPU shots
      </div>

    </div>
  `;

  h += `
    <div class="plan">

      <b>AHM DIRECTOR V8.2</b>

      Format:
      ${esc(
        p.format ||
        "9:16"
      )}

      Target:
      ${esc(
        p.targetLength ??
        p.targetSeconds ??
        ""
      )}s

      Planned:
      ${esc(
        p.plannedSeconds ??
        p.plannedDuration ??
        ""
      )}s

      Subtitles:
      ${
        p.subtitles
          ? "EXACT DIALOGUE"
          : "OFF"
      }

      Narrator:
      ${
        p.noNarrator
          ? "OFF unless scripted"
          : "ALLOWED"
      }

      GLOBAL STYLE
      ${esc(
        (
          p.global &&
          Array.isArray(
            p.global.style
          )
            ? p.global.style
            : []
        ).join("\n") ||
          p.visualStyle ||
          "Cinematic"
      )}

      CONTINUITY LOCK
      Character identity, voice, wardrobe, props,
      geography and chronological story events remain
      locked. No invented story events.
    </div>
  `;

  if (
    Array.isArray(
      validation.warnings
    ) &&
    validation.warnings.length
  ) {
    h += `
      <div class="result">
        <b>Director notes</b>
        <ul>
          ${validation.warnings
            .map(
              w =>
                `<li>${esc(
                  w
                )}</li>`
            )
            .join("")}
        </ul>
      </div>
    `;
  }

  parts.forEach(
    part => {
      const episodeNumber =
        part.episode ??
        part.part ??
        1;

      const duration =
        part.duration ??
        0;

      const partScenes =
        Array.isArray(
          part.scenes
        )
          ? part.scenes
          : [];

      h += `
        <details
          class="episode"
          open
        >

          <summary>
            PART ${esc(
              episodeNumber
            )}
            —
            ${esc(
              duration
            )}s
            •
            ${partScenes.length}
            scene(s)
          </summary>
      `;

      partScenes.forEach(
        s => {
          const sceneNumber =
            s.number ??
            "";

          const sceneTitle =
            s.title ||
            `Scene ${sceneNumber}`;

          const sceneAction =
            Array.isArray(
              s.action
            )
              ? s.action
              : [];

          const sceneDialogue =
            Array.isArray(
              s.dialogue
            )
              ? s.dialogue
              : [];

          const sceneShots =
            Array.isArray(
              s.shots
            )
              ? s.shots
              : [];

          h += `
            <div class="scene">

              <h4>
                SCENE
                ${esc(
                  sceneNumber
                )}
                —
                ${esc(
                  sceneTitle
                )}

                <span class="muted">
                  (
                  ${esc(
                    s.duration ??
                    0
                  )}s
                  )
                </span>
              </h4>

              <div>
                <b>LOCATION</b>

                <p>
                  ${esc(
                    s.location ||
                    "Not specified."
                  )}
                </p>
              </div>

              <div>
                <b>ACTION</b>

                <p>
                  ${esc(
                    sceneAction.join(
                      "\n"
                    )
                  )}
                </p>
              </div>

              ${
                Array.isArray(
                  s.emotion
                ) &&
                s.emotion.length
                  ? `
                    <div>
                      <b>EMOTION</b>
                      <p>
                        ${esc(
                          s.emotion.join(
                            "\n"
                          )
                        )}
                      </p>
                    </div>
                  `
                  : ""
              }

              ${
                Array.isArray(
                  s.sound
                ) &&
                s.sound.length
                  ? `
                    <div>
                      <b>SOUND</b>
                      <p>
                        ${esc(
                          s.sound.join(
                            "\n"
                          )
                        )}
                      </p>
                    </div>
                  `
                  : ""
              }

              <div>
                <b>
                  DIALOGUE — LOCKED
                </b>
          `;

          if (
            sceneDialogue.length
          ) {
            sceneDialogue.forEach(
              d => {
                h += `
                  <div class="shot dialogue">

                    <b>
                      ${esc(
                        d.speaker
                      )}:
                    </b>

                    ${esc(
                      d.text
                    )}

                  </div>
                `;
              }
            );
          } else {
            h += `
              <div class="muted">
                No dialogue in this scene.
              </div>
            `;
          }

          h += `
              </div>

              <div>
                <b>
                  GPU SHOT PLAN
                  (${sceneShots.length})
                </b>
          `;

          sceneShots.forEach(
            (
              sh,
              i
            ) => {
              const visual =
                sh.visual ??
                sh.visualPrompt ??
                sh.action ??
                "";

              const dialogue =
                Array.isArray(
                  sh.dialogue
                )
                  ? sh.dialogue
                  : [];

              h += `
                <div class="shot">

                  <b>
                    ${i + 1}.
                    ${esc(
                      sh.type ||
                      "SHOT"
                    )}
                    —
                    ${esc(
                      sh.camera ||
                      ""
                    )}
                  </b>

                  <br>

                  ${esc(
                    visual
                  )}

                  ${
                    dialogue.length
                      ? `
                        <div class="mini">
                          ${dialogue
                            .map(
                              d =>
                                `<b>${esc(
                                  d.speaker
                                )}:</b> ${esc(
                                  d.text
                                )}`
                            )
                            .join(
                              "<br>"
                            )}
                        </div>
                      `
                      : ""
                  }

                </div>
              `;
            }
          );

          h += `
              </div>

            </div>
          `;
        }
      );

      h += `
        </details>
      `;
    }
  );

  $("#planView").innerHTML =
    h;
}

$("#build").onclick =
  async () => {
    const screenplay =
      $("#screenplay")
        .value
        .trim();

    if (!screenplay) {
      alert(
        "Paste your screenplay first."
      );

      return;
    }

    setStatus(
      "Director is parsing, locking continuity and building shots…"
    );

    $("#build").disabled =
      true;

    $("#generate").disabled =
      true;

    try {
      const response =
        await jsonFetch(
          "/api/director/plan",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                screenplay,

                characters:
                  chars,

                episodes:
                  Number(
                    $("#parts")
                      .value
                  ),

                visualStyle:
                  $("#style")
                    .value,

                format:
                  $("#format")
                    .value,

                targetLength:
                  Number(
                    $("#length")
                      .value
                  ),

                subtitle:
                  $("#subtitles")
                    .value ===
                  "true",

                noNarrator:
                  $("#noNarrator")
                    .checked
              })
          }
        );

      /*
        SERVER RETURNS:
        { ok: true, plan: {...} }

        We must use response.plan,
        not the wrapper itself.
      */
      plan =
        response.plan ||
        response;

      if (
        !plan.validation ||
        !plan.validation.ok
      ) {
        throw new Error(
          "Director plan validation failed."
        );
      }

      renderPlan(
        plan
      );

      $("#planView")
        .classList
        .remove("hidden");

      $("#generate").disabled =
        false;

      setStatus(
        "Plan ready. No GPU request was made."
      );

      scrollTo({
        top:
          $("#planView")
            .getBoundingClientRect()
            .top +
          scrollY -
          70,

        behavior:
          "smooth"
      });
    } catch (e) {
      console.error(
        "Director build error:",
        e
      );

      setStatus(
        e.message,
        true
      );
    } finally {
      $("#build").disabled =
        false;
    }
  };

async function submitRunPod(
  testOnly = false
) {
  if (!plan) {
    alert(
      "Build the Director plan first."
    );

    return;
  }

  /*
    TEST MODE:
    This is completely free while the server
    is configured with AHM_WORKER_MODE=demo.
  */
  if (testOnly) {
    const confirmed =
      confirm(
        "Run the FREE AHM demo test?\n\n" +
        "This validates the production plan locally and does NOT submit a paid GPU job."
      );

    if (!confirmed) {
      return;
    }
  } else {
    const confirmed =
      confirm(
        "This will submit a REAL GPU generation job to RunPod and may cost money.\n\nContinue?"
      );

    if (!confirmed) {
      return;
    }
  }

  $("#testGpu").disabled =
    true;

  $("#generate").disabled =
    true;

  setStatus(
    testOnly
      ? "Running free production contract test…"
      : "Submitting GPU generation…"
  );

  try {
    const d =
      await jsonFetch(
        "/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              plan,
              testOnly
            })
        }
      );

    $("#generationView")
      .classList
      .remove("hidden");

    $("#generationView").innerHTML = `
      <div class="result">

        <b>
          ${
            d.demo
              ? "Free AHM demo test completed."
              : "RunPod job submitted."
          }
        </b>

        <p>
          Job ID:
          <code>
            ${esc(
              d.id ||
              "unknown"
            )}
          </code>
        </p>

        ${
          d.message
            ? `<p>${esc(
                d.message
              )}</p>`
            : ""
        }

        <pre>${esc(
          JSON.stringify(
            d,
            null,
            2
          )
        )}</pre>

      </div>
    `;

    if (
      d.demo &&
      d.status ===
        "COMPLETED"
    ) {
      setStatus(
        "Free demo test completed successfully. No GPU was charged."
      );

      return;
    }

    setStatus(
      "Job submitted. Monitoring status…"
    );

    if (d.id) {
      pollJob(
        d.id
      );
    }
  } catch (e) {
    console.error(
      "Generation error:",
      e
    );

    setStatus(
      e.message,
      true
    );

    $("#generationView")
      .classList
      .remove("hidden");

    $("#generationView").innerHTML = `
      <div class="result bad">
        ${esc(
          e.message
        )}
      </div>
    `;
  } finally {
    $("#testGpu").disabled =
      false;

    $("#generate").disabled =
      false;
  }
}

$("#testGpu").onclick =
  () =>
    submitRunPod(
      true
    );

$("#generate").onclick =
  () =>
    submitRunPod(
      false
    );

async function pollJob(
  jobId
) {
  for (
    let i = 0;
    i < 240;
    i++
  ) {
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          5000
        )
    );

    try {
      /*
        Server supports POST /api/job-status
        with { id: jobId }.
      */
      const d =
        await jsonFetch(
          "/api/job-status",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                id: jobId
              })
          }
        );

      const output =
        d.output
          ? `
            <p>
              <b>Output:</b>
            </p>

            <pre>
              ${esc(
                JSON.stringify(
                  d.output,
                  null,
                  2
                )
              )}
            </pre>
          `
          : "";

      $("#generationView").innerHTML = `
        <div class="result">

          <b>RunPod Job</b>

          <p>
            Status:
            <strong>
              ${esc(
                d.status ||
                "UNKNOWN"
              )}
            </strong>
          </p>

          ${
            d.progress != null
              ? `
                <p>
                  Progress:
                  ${esc(
                    d.progress
                  )}%
                </p>
              `
              : ""
          }

          ${
            d.message
              ? `
                <p>
                  ${esc(
                    d.message
                  )}
                </p>
              `
              : ""
          }

          ${output}

          <pre>
            ${esc(
              JSON.stringify(
                {
                  ...d,
                  output:
                    undefined
                },
                null,
                2
              )
            )}
          </pre>

        </div>
      `;

      const status =
        String(
          d.status ||
            ""
        ).toUpperCase();

      if (
        status ===
          "COMPLETED" ||
        status ===
          "SUCCEEDED" ||
        status ===
          "READY"
      ) {
        setStatus(
          "RunPod job completed."
        );

        return;
      }

      if (
        [
          "FAILED",
          "ERROR",
          "CANCELLED",
          "TIMED_OUT"
        ].includes(
          status
        )
      ) {
        setStatus(
          `GPU job ended: ${status}`,
          true
        );

        return;
      }
    } catch (e) {
      console.error(
        "Status check error:",
        e
      );

      $("#generationView")
        .innerHTML = `
          <div class="result bad">

            Status check failed:
            ${esc(
              e.message
            )}

            <br>

            Job ID:
            ${esc(
              jobId
            )}

          </div>
        `;

      setStatus(
        "Could not monitor the GPU job.",
        true
      );

      return;
    }
  }

  setStatus(
    "Stopped polling after 20 minutes. Check the RunPod job status.",
    true
  );
}

$("#saveDraft").onclick =
  async () => {
    const screenplay =
      $("#screenplay")
        .value
        .trim();

    if (!screenplay) {
      alert(
        "Nothing to save."
      );

      return;
    }

    try {
      const firstLine =
        screenplay
          .split("\n")
          .find(
            x =>
              x.trim()
          );

      await jsonFetch(
        "/api/projects",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              title:
                (
                  firstLine ||
                  "Untitled"
                ).slice(
                  0,
                  80
                ),

              screenplay,

              characters:
                chars,

              plan
            })
        }
      );

      $("#scriptStatus")
        .textContent =
        "Draft saved on the server filesystem.";
    } catch (e) {
      $("#scriptStatus")
        .textContent =
        e.message;
    }
  };

renderChars();

wordCount();

refreshHealth();
