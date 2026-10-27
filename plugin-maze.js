/*
 * jsPsych plugin: maze
 *
 * One maze per trial. The participant walks from the start to the exit with
 * the arrow keys. Bushes appear when the participant is within
 * `reveal_radius` walking steps. Walking into a bush opens a card asking the
 * participant to press the space bar. That reveals the next item from
 * `encounters` (picture, name, points), shown for exactly `encounter_duration`
 * ms, while the points total counts up in green or down in red. The participant
 * can't move while the card is open. Reaching the exit shows a "solved" card
 * that adds `completion_bonus` points; the trial ends when the participant
 * presses the space bar.
 *
 * Question mode (mode: "question"): bushes don't reveal anything. Instead the
 * card asks, one question at a time: (1) a guess of which animal is in the bush,
 * (2) which animal first came to mind, both free text; then, in the action
 * condition, (3) go through or avoid. Answers are recorded; scoring is left to
 * the experiment, so nothing about the bush's contents is shown.
 *
 * Maze rows use: '#' wall, '.' path, 'S' start, 'E' exit, 'B' bush.
 * Mazes are made with the separate maze generator page and pasted in as data,
 * so every participant gets the same mazes.
 */
var jsPsychMaze = (function (jspsych) {
  "use strict";

  const info = {
    name: "maze",
    version: "0.7.0",
    parameters: {
      /** The maze, as an array of equal-length strings. */
      maze: { type: jspsych.ParameterType.STRING, array: true, default: undefined },
      /** What's in each bush, in the order bushes are entered. Each item is
       *  { name, img, value }. Must contain one item per bush in the maze. */
      encounters: { type: jspsych.ParameterType.COMPLEX, array: true, default: undefined },
      /** Points at the start of this maze (carry the total over between mazes). */
      start_score: { type: jspsych.ParameterType.INT, default: 0 },
      /** How long the animal and its points are shown after the space bar is pressed, in ms. Fixed for everyone. */
      encounter_duration: { type: jspsych.ParameterType.INT, default: 1500 },
      /** Text on the card that asks the participant to press the space bar. */
      bush_prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "You have to go through a bush.<br>Press the space bar to see which animal is in it.",
      },
      /** Wait this long after the animal appears before the points total starts to change, in ms. */
      count_delay: { type: jspsych.ParameterType.INT, default: 300 },
      /** How long the points total takes to count up or down, in ms. The same for every
       *  value, so big gains and losses aren't on screen longer than small ones. */
      count_duration: { type: jspsych.ParameterType.INT, default: 800 },
      /** A bush appears when the participant is this many walking steps away. */
      reveal_radius: { type: jspsych.ParameterType.INT, default: 2 },
      /** Size of one maze square, in pixels. */
      cell_size: { type: jspsych.ParameterType.INT, default: 24 },
      /** Whether to show the running points total above the maze. */
      show_score: { type: jspsych.ParameterType.BOOL, default: true },
      /** Text shown above the maze. */
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "<p>Use the arrow keys to walk to the exit.</p>",
      },
      /** Points added for solving the maze, shown on the "solved" card at the exit. */
      completion_bonus: { type: jspsych.ParameterType.INT, default: 0 },
      /** Heading on the card shown at the exit. */
      completion_message: { type: jspsych.ParameterType.HTML_STRING, default: "You solved this maze!" },
      /** The "solved" card can be closed with the space bar after this many ms. */
      completion_min_duration: { type: jspsych.ParameterType.INT, default: 1500 },
      /** "learn": bushes show the animal and its points. "question": bushes ask
       *  questions instead, and nothing is revealed. */
      mode: { type: jspsych.ParameterType.STRING, default: "learn" },
      /** Question mode: "epistemic" (guess, then first animal) or
       *  "action" (guess, then first animal, then go through or avoid). */
      question_condition: { type: jspsych.ParameterType.STRING, default: "epistemic" },
      /** Question mode, step 1: the guess. */
      guess_prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "Guess what animal you think is in the bush.",
      },
      /** Question mode, step 2: which animal first came to mind. */
      first_mention_prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "<strong>Which animal first came to your mind after seeing the bush?</strong><br>" +
                 "Even if it was not your final answer, write the first animal that popped into your mind when you saw the bush.",
      },
      /** Question mode, action, step 3: the choice. */
      decision_prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "Do you want to go through the bush or avoid it?",
      },
      /** Question mode, action: the two options, recorded as "go_through" and "avoid". */
      decision_labels: { type: jspsych.ParameterType.STRING, array: true, default: ["Go through", "Avoid"] },
    },
    data: {
      /** One record per bush. Learn mode: order, name, value, score_after, row, col,
       *  prompt_onset (bush card appears), reveal_rt (ms from bush card to space bar),
       *  onset (animal appears). Question mode: order, name and value (what was in the
       *  bush, never shown), row, col, prompt_onset; guess, guess_keypress_rt, guess_rt;
       *  first_animal, first_keypress_rt, first_rt; and in the action condition
       *  decision and decision_rt. Each *_keypress_rt is ms from that question
       *  appearing to the first keypress, each *_rt ms to submitting.
       *  Onsets in ms from trial start. */
      encounters: { type: jspsych.ParameterType.COMPLEX, array: true },
      /** Points at the end of this maze, including the completion bonus. */
      final_score: { type: jspsych.ParameterType.INT },
      /** Points added for solving the maze. */
      completion_bonus: { type: jspsych.ParameterType.INT },
      /** Number of steps taken (moves into open squares). */
      n_steps: { type: jspsych.ParameterType.INT },
      /** Every square visited, in order, as "row,col". */
      path: { type: jspsych.ParameterType.STRING, array: true },
      /** Time from trial start to reaching the exit, in ms (the "solved" card isn't included). */
      rt: { type: jspsych.ParameterType.INT },
    },
  };

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const KEYS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

  const COLORS = {
    hedge: "#2F4A2C", path: "#E9E2CF", startTile: "#CFDCEB",
    bush: "#6E9B45", bushDark: "#4A7330", bushUsed: "#B7C9A3",
    player: "#3B6EA5", exit: "#C99A2E", text: "#1F2421",
  };

  // The bush on the card: same colors as the bushes in the maze, larger.
  const BUSH_SVG = `<svg viewBox="0 0 180 150" aria-hidden="true">
      <circle cx="58" cy="92" r="44" fill="${COLORS.bush}"/>
      <circle cx="122" cy="92" r="44" fill="${COLORS.bush}"/>
      <circle cx="90" cy="58" r="46" fill="${COLORS.bush}"/>
      <circle cx="90" cy="104" r="40" fill="${COLORS.bush}"/>
      <circle cx="64" cy="86" r="9" fill="${COLORS.bushDark}"/>
      <circle cx="112" cy="62" r="8" fill="${COLORS.bushDark}"/>
      <circle cx="104" cy="108" r="7" fill="${COLORS.bushDark}"/>
      <circle cx="74" cy="44" r="6" fill="${COLORS.bushDark}"/>
    </svg>`;

  const CSS = `
    .maze-wrap { display: inline-block; text-align: left; }
    .maze-score { font-size: 1.125rem; font-weight: 600; margin: 4px 0; }
    .maze-stage { position: relative; display: inline-block; }
    .maze-stage canvas { display: block; }
    .maze-card { position: absolute; inset: 0; display: none; align-items: center;
      justify-content: center; background: rgba(31, 36, 33, 0.35); }
    .maze-card.open { display: flex; }
    .maze-card-inner { background: #FFFFFF; border-radius: 12px; padding: 20px 28px;
      text-align: center; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); min-width: 240px; }
    .maze-card-inner img { width: 200px; height: 200px; display: block; margin: 0 auto 8px; }
    .maze-card-name { font-size: 1.75rem; font-weight: 700; margin: 12px 0 0; line-height: 1.2; }
    .maze-card-points { font-size: 2rem; font-weight: 700; margin: 0 0 8px;
      font-variant-numeric: tabular-nums; }
    .maze-gain { color: #2E6B2F; }
    .maze-loss { color: #A3261E; }
    .maze-bush-view p { font-size: 1.25rem; margin: 0 0 12px; line-height: 1.4; }
    .maze-bush svg { display: block; width: 180px; height: 150px; margin: 0 auto; }
    .maze-total { margin: 4px 0 0;
      font-size: 1.125rem; color: #1F2421; }
    .maze-total-num { display: inline-block; min-width: 2.5ch; font-size: 1.75rem; font-weight: 700;
      font-variant-numeric: tabular-nums; transition: color 0.2s ease; }
    .maze-total-arrow { display: inline-block; width: 1.2em; font-size: 1.25rem; font-weight: 700; }
    .maze-q-view { max-width: 520px; font-size: 1.1rem; line-height: 1.5; }
    .maze-q-view p { margin: 8px 0; }
    .maze-q-view .maze-bush svg { width: 140px; height: 116px; }
    .maze-q-options { display: flex; gap: 14px; justify-content: center; margin: 6px 0 10px; }
    .maze-q-input { font: inherit; padding: 6px 10px; width: 240px; margin: 2px 0 4px; }
    .maze-q-hint { color: #A3261E; font-size: 0.95rem; min-height: 1.3em; margin: 2px 0; }
    .maze-done-view h2 { font-size: 1.75rem; margin: 4px 0 8px; }
    .maze-done-view .maze-card-points { margin: 0; }
    .maze-done-view .maze-total { margin-top: 10px; }
    .maze-continue { font-size: 0.95rem; color: #55605A; min-height: 1.4em; margin: 14px 0 0; }
  `;

  // Show negative totals with a real minus sign, matching the animal's points.
  const fmt = (v) => (v < 0 ? "\u2212" + Math.abs(v) : String(v));

  function isOpen(grid, r, c) {
    return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length && grid[r][c] !== "#";
  }

  // Walking steps from the source squares, through open squares only, up to maxD.
  function walkingDistances(grid, sources, maxD) {
    const d = grid.map((row) => row.map(() => Infinity));
    const queue = [];
    for (const [r, c] of sources) { d[r][c] = 0; queue.push([r, c]); }
    let head = 0;
    while (head < queue.length) {
      const [r, c] = queue[head++];
      if (d[r][c] >= maxD) continue;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (isOpen(grid, nr, nc) && d[nr][nc] === Infinity) {
          d[nr][nc] = d[r][c] + 1;
          queue.push([nr, nc]);
        }
      }
    }
    return d;
  }

  function drawBush(ctx, x, y, cell, used) {
    const cx = x + cell / 2, cy = y + cell / 2, s = cell * 0.2;
    ctx.fillStyle = used ? COLORS.bushUsed : COLORS.bush;
    for (const [dx, dy] of [[-1, 0.4], [1, 0.4], [0, -0.6], [0, 0.6]]) {
      ctx.beginPath();
      ctx.arc(cx + dx * s, cy + dy * s, s * 1.35, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (!used) {
      ctx.fillStyle = COLORS.bushDark;
      ctx.beginPath(); ctx.arc(cx - s * 0.5, cy + s * 0.2, s * 0.35, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s * 0.6, cy - s * 0.3, s * 0.3, 0, 2 * Math.PI); ctx.fill();
    }
  }

  function draw(canvas, state, cell) {
    const g = state.grid, margin = Math.round(cell * 1.6), H = g.length, W = g[0].length;
    canvas.width = W * cell + 2 * margin;
    canvas.height = H * cell + 2 * margin;
    const ctx = canvas.getContext("2d");

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const ch = g[r][c], x = margin + c * cell, y = margin + r * cell;
        ctx.fillStyle = ch === "#" ? COLORS.hedge : ch === "S" ? COLORS.startTile : COLORS.path;
        ctx.fillRect(x, y, cell, cell);
        if (ch === "E") {
          ctx.fillStyle = COLORS.exit;
          ctx.fillRect(x + cell * 0.1, y, cell * 0.8, cell);
        }
        const key = r + "," + c;
        if (ch === "B" && state.revealed.has(key)) drawBush(ctx, x, y, cell, state.used.has(key));
      }
    }

    ctx.fillStyle = COLORS.text;
    ctx.font = `600 ${Math.round(cell * 0.55)}px "Segoe UI", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Start", margin + 1.5 * cell, margin - cell * 0.35);

    const [er, ec] = state.exit;
    const ex = margin + ec * cell + cell / 2, ey = margin + er * cell + cell;
    ctx.fillStyle = COLORS.exit;
    ctx.beginPath();
    ctx.moveTo(ex - cell * 0.3, ey + cell * 0.1);
    ctx.lineTo(ex + cell * 0.3, ey + cell * 0.1);
    ctx.lineTo(ex, ey + cell * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Exit", ex - cell * 0.55, ey + cell * 0.35);

    const [pr, pc] = state.player;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(margin + pc * cell + cell / 2, margin + pr * cell + cell / 2, cell * 0.32, 0, 2 * Math.PI);
    ctx.fill();
  }

  class MazePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      // ---- set up the maze state -------------------------------------------
      const grid = trial.maze.map((row) => row.split(""));
      let start, exit, nBushes = 0;
      grid.forEach((row, r) => row.forEach((ch, c) => {
        if (ch === "S") start = [r, c];
        if (ch === "E") exit = [r, c];
        if (ch === "B") nBushes++;
      }));
      if (!start || !exit) throw new Error("maze plugin: the maze needs one 'S' and one 'E'.");
      if (!trial.encounters || trial.encounters.length < nBushes) {
        throw new Error(`maze plugin: this maze has ${nBushes} bushes but only ` +
          `${trial.encounters ? trial.encounters.length : 0} encounters were given.`);
      }

      const state = { grid, player: start.slice(), exit, revealed: new Set(), used: new Set() };
      let score = trial.start_score;
      let busy = false;          // true while a card or the exit message is showing
      const encounterData = [];
      const path = [start.join(",")];
      let nSteps = 0;
      const t0 = performance.now();

      // ---- page -----------------------------------------------------------
      if (!document.getElementById("jspsych-maze-css")) {
        const style = document.createElement("style");
        style.id = "jspsych-maze-css";
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      display_element.innerHTML = `
        <div class="maze-wrap">
          ${trial.prompt}
          <div class="maze-score" ${trial.show_score ? "" : 'style="display:none"'}>Points: ${fmt(score)}</div>
          <div class="maze-stage">
            <canvas></canvas>
            <div class="maze-card" aria-live="polite">
              <div class="maze-card-inner">
                <div class="maze-bush-view">
                  <p>${trial.bush_prompt}</p>
                  <div class="maze-bush">${BUSH_SVG}</div>
                </div>
                <div class="maze-animal-view">
                  <p class="maze-card-points"></p>
                  <img alt="">
                  <div class="maze-total">Your points: <span class="maze-total-num"></span><span class="maze-total-arrow"></span></div>
                  <p class="maze-card-name"></p>
                </div>
                <div class="maze-q-view" style="display:none">
                  <div class="maze-bush">${BUSH_SVG}</div>
                  <p class="maze-q-text"></p>
                  <input type="text" class="maze-q-input" autocomplete="off" spellcheck="false" aria-label="Your answer">
                  <div class="maze-q-options" style="display:none">
                    <button type="button" class="jspsych-btn maze-q-choice" data-choice="go_through">${trial.decision_labels[0]}</button>
                    <button type="button" class="jspsych-btn maze-q-choice" data-choice="avoid">${trial.decision_labels[1]}</button>
                  </div>
                  <p class="maze-q-hint"></p>
                  <button type="button" class="jspsych-btn maze-q-submit">Submit</button>
                </div>
                <div class="maze-done-view" style="display:none">
                  <h2>${trial.completion_message}</h2>
                  <p class="maze-card-points maze-gain">+${trial.completion_bonus} points</p>
                  <div class="maze-total">Your points: <span class="maze-total-num"></span><span class="maze-total-arrow"></span></div>
                  <p class="maze-continue"></p>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      const canvas = display_element.querySelector("canvas");
      const scoreEl = display_element.querySelector(".maze-score");
      const cardEl = display_element.querySelector(".maze-card");

      const reveal = () => {
        const d = walkingDistances(grid, [state.player], trial.reveal_radius);
        grid.forEach((row, r) => row.forEach((ch, c) => {
          if (ch === "B" && d[r][c] <= trial.reveal_radius) state.revealed.add(r + "," + c);
        }));
      };
      const render = () => {
        if (!busy) scoreEl.textContent = "Points: " + fmt(score);
        draw(canvas, state, trial.cell_size);
      };

      // ---- encounters ---------------------------------------------------------
      // Two steps: (1) a card asks the participant to press the space bar;
      // (2) that reveals the animal and its points, and the points total
      // counts up (green) or down (red) in front of them. The card closes
      // encounter_duration ms after the animal appears.
      const bushView = cardEl.querySelector(".maze-bush-view");
      const animalView = cardEl.querySelector(".maze-animal-view");
      const totalNum = animalView.querySelector(".maze-total-num");
      const totalArrow = animalView.querySelector(".maze-total-arrow");
      let pending = null;        // the encounter waiting for the space bar

      const showEncounter = (r, c) => {
        if (trial.mode === "question") return showQuestion(r, c);
        busy = true;
        pending = { r, c, promptOnset: performance.now() };
        bushView.style.display = "block";
        animalView.style.display = "none";
        cardEl.classList.add("open");
      };

      // Count a "Your points" line from one total to another, in green (up) or red (down).
      const countTo = (numEl, arrowEl, from, to, cls) => {
        const startAt = performance.now();
        numEl.className = "maze-total-num " + cls;
        arrowEl.className = "maze-total-arrow " + cls;
        arrowEl.textContent = to > from ? "\u25B2" : "\u25BC";    // up or down arrow
        const step = (now) => {
          if (!display_element.contains(numEl)) return;              // trial already over
          const t = Math.min(1, (now - startAt) / trial.count_duration);
          const eased = 1 - Math.pow(1 - t, 3);                        // fast, then settling
          const shown = Math.round(from + (to - from) * eased);
          numEl.textContent = fmt(shown);
          scoreEl.textContent = "Points: " + fmt(shown);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };

      const onReveal = (e) => {
        if (e.key !== " " || typing(e)) return;
        e.preventDefault();                        // stop the page from scrolling
        if (!pending) return;                      // space only opens a bush that's waiting
        const { r, c, promptOnset } = pending;
        pending = null;
        const item = trial.encounters[encounterData.length];
        const before = score;
        score += item.value;
        const now = performance.now();
        encounterData.push({
          order: encounterData.length + 1, name: item.name, value: item.value,
          score_after: score, row: r, col: c,
          prompt_onset: Math.round(promptOnset - t0),
          reveal_rt: Math.round(now - promptOnset),
          onset: Math.round(now - t0),
        });

        const img = animalView.querySelector("img");
        img.src = item.img;
        img.alt = item.name;
        animalView.querySelector(".maze-card-name").textContent =
          item.name.charAt(0).toUpperCase() + item.name.slice(1);
        const pts = animalView.querySelector(".maze-card-points");
        pts.textContent = (item.value > 0 ? "+" : "\u2212") + Math.abs(item.value) +
          (Math.abs(item.value) === 1 ? " point" : " points");
        pts.className = "maze-card-points " + (item.value > 0 ? "maze-gain" : "maze-loss");
        totalNum.textContent = fmt(before);
        totalNum.className = "maze-total-num";
        totalArrow.textContent = "";
        bushView.style.display = "none";
        animalView.style.display = "block";

        this.jsPsych.pluginAPI.setTimeout(
          () => countTo(totalNum, totalArrow, before, score, item.value > 0 ? "maze-gain" : "maze-loss"),
          trial.count_delay);
        this.jsPsych.pluginAPI.setTimeout(() => {      // fixed exposure, then close automatically
          cardEl.classList.remove("open");
          scoreEl.textContent = "Points: " + fmt(score);
          busy = false;
        }, trial.encounter_duration);
      };

      // ---- question mode ------------------------------------------------------
      // One question at a time, each replacing the last:
      //   1) guess   2) first animal that came to mind   3) action only: go through or avoid
      const qView = cardEl.querySelector(".maze-q-view");
      const qText = qView.querySelector(".maze-q-text");
      const qInput = qView.querySelector(".maze-q-input");
      const qOptions = qView.querySelector(".maze-q-options");
      const qHint = qView.querySelector(".maze-q-hint");
      const qSubmit = qView.querySelector(".maze-q-submit");
      const qChoices = [...qView.querySelectorAll(".maze-q-choice")];
      const TEXT_STEPS = [
        { key: "guess", prompt: () => trial.guess_prompt },
        { key: "first", prompt: () => trial.first_mention_prompt },
      ];
      let q = null;              // the bush currently being asked about

      const askText = (i) => {
        q.step = i;
        q.askedAt = performance.now();
        qText.innerHTML = TEXT_STEPS[i].prompt();
        qInput.value = "";
        qInput.style.display = "";
        qSubmit.style.display = "";
        qOptions.style.display = "none";
        qHint.textContent = "";
        qInput.focus();
      };

      const askDecision = () => {
        q.step = "decision";
        q.askedAt = performance.now();
        qText.innerHTML = trial.decision_prompt;
        qInput.style.display = "none";
        qSubmit.style.display = "none";
        qHint.textContent = "";
        qOptions.style.display = "flex";
      };

      const showQuestion = (r, c) => {
        busy = true;
        const item = trial.encounters[encounterData.length];
        q = { rec: {
          order: encounterData.length + 1, name: item.name, value: item.value, row: r, col: c,
          prompt_onset: Math.round(performance.now() - t0),
          guess_keypress_rt: null, first_keypress_rt: null } };
        bushView.style.display = "none";
        animalView.style.display = "none";
        qView.style.display = "block";
        cardEl.classList.add("open");
        askText(0);
      };

      qInput.addEventListener("input", () => {
        if (!q || typeof q.step !== "number") return;
        const field = TEXT_STEPS[q.step].key + "_keypress_rt";
        if (q.rec[field] === null) q.rec[field] = Math.round(performance.now() - q.askedAt);
      });

      const closeQuestion = () => {
        encounterData.push(q.rec);
        q = null;
        cardEl.classList.remove("open");
        qView.style.display = "none";
        busy = false;
      };

      const submitText = () => {
        if (!q || typeof q.step !== "number") return;
        const answer = qInput.value.trim();
        if (!answer) { qHint.textContent = "Please write an animal before continuing."; qInput.focus(); return; }
        const rt = Math.round(performance.now() - q.askedAt);
        if (q.step === 0) { q.rec.guess = answer; q.rec.guess_rt = rt; }
        else { q.rec.first_animal = answer; q.rec.first_rt = rt; }
        if (q.step < TEXT_STEPS.length - 1) askText(q.step + 1);
        else if (trial.question_condition === "action") askDecision();
        else closeQuestion();
      };
      qSubmit.addEventListener("click", submitText);
      qInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); submitText(); }
      });
      qChoices.forEach((b) => b.addEventListener("click", () => {
        if (!q || q.step !== "decision") return;
        q.rec.decision = b.dataset.choice;
        q.rec.decision_rt = Math.round(performance.now() - q.askedAt);
        b.blur();
        closeQuestion();
      }));

      // ---- movement -----------------------------------------------------------
      const typing = (e) => e.target && e.target.tagName === "INPUT";
      const onKey = (e) => {
        if (!(e.key in KEYS) || typing(e)) return;
        e.preventDefault();                        // stop the page from scrolling
        if (busy) return;                          // no moving while a card is up
        const [dr, dc] = KEYS[e.key];
        const nr = state.player[0] + dr, nc = state.player[1] + dc;
        if (!isOpen(grid, nr, nc)) return;
        state.player = [nr, nc];
        nSteps++;
        path.push(nr + "," + nc);
        reveal();
        const key = nr + "," + nc;
        if (grid[nr][nc] === "B" && !state.used.has(key)) {
          state.used.add(key);
          showEncounter(nr, nc);
        }
        render();
        if (nr === exit[0] && nc === exit[1]) finish();
      };

      // At the exit: a "solved" card adds the completion bonus, counting the
      // total up, then the space bar ends the trial.
      const finish = () => {
        busy = true;
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("keydown", onReveal);
        const rt = Math.round(performance.now() - t0);
        const before = score;
        score += trial.completion_bonus;

        const doneView = cardEl.querySelector(".maze-done-view");
        const doneNum = doneView.querySelector(".maze-total-num");
        const doneArrow = doneView.querySelector(".maze-total-arrow");
        const continueEl = doneView.querySelector(".maze-continue");
        doneNum.textContent = fmt(before);
        bushView.style.display = "none";
        animalView.style.display = "none";
        qView.style.display = "none";
        doneView.style.display = "block";
        if (trial.completion_bonus === 0) {
          doneView.querySelector(".maze-card-points").style.display = "none";
          doneView.querySelector(".maze-total").style.display = "none";
        }
        cardEl.classList.add("open");
        if (trial.completion_bonus !== 0) {
          this.jsPsych.pluginAPI.setTimeout(
            () => countTo(doneNum, doneArrow, before, score, trial.completion_bonus > 0 ? "maze-gain" : "maze-loss"),
            trial.count_delay);
        }

        const end = (e) => {
          if (e.key !== " ") return;
          e.preventDefault();
          document.removeEventListener("keydown", end);
          display_element.innerHTML = "";
          this.jsPsych.finishTrial({
            encounters: encounterData,
            final_score: score,
            completion_bonus: trial.completion_bonus,
            n_steps: nSteps,
            path: path,
            rt: rt,
          });
        };
        this.jsPsych.pluginAPI.setTimeout(() => {
          continueEl.textContent = "Press the space bar to continue";
          document.addEventListener("keydown", end);
        }, Math.max(trial.completion_min_duration, trial.count_delay + trial.count_duration));
      };

      document.addEventListener("keydown", onKey);
      document.addEventListener("keydown", onReveal);
      reveal();
      render();
    }
  }
  MazePlugin.info = info;
  // The bush picture, so other screens (like the final question) can show the same bush.
  MazePlugin.BUSH_SVG = BUSH_SVG;

  return MazePlugin;
})(jsPsychModule);
