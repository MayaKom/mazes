// Maze study: the experiment itself (timeline, design, scoring, preview mode).
// Loaded by experiment.html after jsPsych, the plugins, plugin-maze.js, mazes.js and consent.js.

// ---------------------------------------------------------------------------
// How the page starts
//   experiment.html                     the real study, from the consent form
//   experiment.html?preview             a menu to pick a condition and where to start
//   experiment.html?preview&condition=action&start=question&mazes=1
//                                       skip the menu: start= consent | intro | training |
//                                       question | quiz; mazes= how many training mazes
// Preview runs are marked preview: true in the data.
// ---------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const PREVIEW = window.FORCE_PREVIEW === true || params.has("preview");
const SECTIONS = ["consent", "intro", "training", "question", "quiz"];
// Animal pictures: files in img/, or built into the page in the single-file preview.
const imgSrc = (a) => (window.ANIMAL_IMAGES && window.ANIMAL_IMAGES[a]) || `img/${a}.png`;

if (PREVIEW && !params.has("start")) {
  showPreviewMenu();
} else {
  runStudy({
    condition: params.get("condition"),
    start: SECTIONS.includes(params.get("start")) ? params.get("start") : "consent",
    mazes: Math.min(Math.max(Number(params.get("mazes")) || MAZES.length, 1), MAZES.length),
    preview: PREVIEW,
  });
}

function showPreviewMenu() {
  const menu = document.createElement("div");
  menu.className = "preview-menu";
  menu.innerHTML = `
    <h1>Preview the maze study</h1>
    <p>Choose a condition and where to start. Parts before the starting point are skipped.
       Nothing you do in the preview is saved.</p>
    <fieldset><legend>Condition</legend>
      <label><input type="radio" name="condition" value="epistemic" checked> Epistemic</label>
      <label><input type="radio" name="condition" value="action"> Action</label>
    </fieldset>
    <fieldset><legend>Start at</legend>
      <label><input type="radio" name="start" value="consent" checked> The consent form (the whole study)</label>
      <label><input type="radio" name="start" value="intro"> The introduction</label>
      <label><input type="radio" name="start" value="training"> The training mazes</label>
      <label><input type="radio" name="start" value="question"> The question maze (3 bushes)</label>
      <label><input type="radio" name="start" value="quiz"> The final questions about the animals' points</label>
    </fieldset>
    <fieldset><legend>Training mazes</legend>
      <label><input type="radio" name="mazes" value="1" checked> Just the first maze</label>
      <label><input type="radio" name="mazes" value="${MAZES.length}"> All ${MAZES.length} mazes</label>
    </fieldset>
    <button type="button" class="jspsych-btn" id="preview-start">Start the preview</button>`;
  document.body.appendChild(menu);
  document.getElementById("preview-start").addEventListener("click", () => {
    const pick = (name) => menu.querySelector(`input[name="${name}"]:checked`).value;
    const opts = { condition: pick("condition"), start: pick("start"), mazes: Number(pick("mazes")), preview: true };
    menu.remove();
    runStudy(opts);
  });
}

function runStudy(opts) {
const startAt = SECTIONS.indexOf(opts.start);
const include = (section) => SECTIONS.indexOf(section) >= startAt;
if (opts.preview) {
  const tag = document.createElement("div");
  tag.className = "preview-tag";
  tag.textContent = `Preview: ${opts.condition || "random"} condition, nothing is saved`;
  document.body.appendChild(tag);
}

// When the experiment ends, show the data on screen (replace with saving to your server later).
// If the participant doesn't consent, nothing is shown or saved.
let consentDeclined = false;
const jsPsych = initJsPsych({
  on_finish: () => {
    if (consentDeclined) return;
    jsPsych.data.displayData("json");
  },
});
window.jsPsych = jsPsych;                      // handy for checking data in the browser console

// ---------------------------------------------------------------------------
// Condition: "epistemic" or "action". Random by default; add ?condition=action
// (or ?condition=epistemic) to the address to choose one when testing.
// For the real study, assign conditions in balanced numbers from your server.
// ---------------------------------------------------------------------------
const CONDITION = ["epistemic", "action"].includes(opts.condition)
  ? opts.condition
  : jsPsych.randomization.sampleWithoutReplacement(["epistemic", "action"], 1)[0];
jsPsych.data.addProperties({ condition: CONDITION, preview: !!opts.preview });

// ---------------------------------------------------------------------------
// Design
// ---------------------------------------------------------------------------
const ANIMALS = ["turtle", "fox", "owl", "squirrel", "rabbit", "mouse", "beaver", "lizard"];
const VALUES  = [-25, -7, -3, -1, 1, 3, 7, 25];
const COUNTS  = [  9,  9, 16,  6, 16,  6, 11, 10];   // encounters per value (83 total)
const START_POINTS = 100;                            // everyone starts with this many points
const MAZE_BONUS = 50;                               // points for solving each maze
const GUESS_POINTS = 10;                             // points for each correct guess (bush contents, animal values)
const MAX_VALUE = Math.max(...VALUES.map(Math.abs));  // the slider in the final questions runs from -MAX_VALUE to +MAX_VALUE

// Random animal-to-value pairing for this participant.
const shuffledAnimals = jsPsych.randomization.shuffle(ANIMALS);
const mapping = VALUES.map((v, i) => ({
  name: shuffledAnimals[i], value: v, count: COUNTS[i], img: imgSrc(shuffledAnimals[i]),
}));
const valueOf = Object.fromEntries(mapping.map((m) => [m.name, m.value]));
// Saved on every row of the data, so the pairing is never lost.
jsPsych.data.addProperties({ animal_values: JSON.stringify(valueOf) });

// Every planned encounter, in a random order. Each bush the participant
// enters shows the next one, so contents depend on order, never on location.
let plan = [];
mapping.forEach((m) => {
  for (let k = 0; k < m.count; k++) plan.push({ name: m.name, img: m.img, value: m.value });
});
plan = jsPsych.randomization.shuffle(plan);

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (v) => (v > 0 ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v);
const pointsText = (v) => `${signed(v)} ${Math.abs(v) === 1 ? "point" : "points"}`;
const total = (v) => (v < 0 ? "\u2212" + Math.abs(v) : String(v));
const timeline = [];

// ---------------------------------------------------------------------------
// 1. Consent (text in consent.js)
// ---------------------------------------------------------------------------
if (include("consent")) timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="consent"><h2>${CONSENT_TITLE}</h2>${CONSENT_HTML}</div>`,
  choices: ["I do NOT consent", "I consent"],
  data: { task: "consent" },
  on_finish: (data) => {
    data.consented = data.response === 1;
    if (!data.consented) {
      consentDeclined = true;
      jsPsych.abortExperiment("<p>You chose not to take part. Thank you for your time. You can now close this window.</p>");
    }
  },
});

timeline.push({
  type: jsPsychPreload,
  images: ANIMALS.map(imgSrc),
});

// ---------------------------------------------------------------------------
// 2. Introduction
// ---------------------------------------------------------------------------
if (include("intro")) timeline.push({
  type: jsPsychInstructions,
  pages: [
    `<div class="intro"><p>In this task you will be solving mazes! As you go through the mazes you will
     encounter bushes and there will usually be animals hiding in them.</p></div>`,
    `<div class="intro"><p>Across all mazes you will encounter the same animals. Some animals will win
     you points while others will lose you points.</p></div>`,
    `<div class="intro"><p>In some cases you will have a choice whether to meet or avoid the animal
     so keep track of the points they give or take from you.</p></div>`,
    `<div class="intro"><p>Your bonus payment will be determined by the number of points you have at the
     end of the task.</p></div>`,
    `<div class="intro"><p>Use the arrow keys to walk through each maze to the exit.</p>
     <p>You start with ${START_POINTS} points, and you win ${MAZE_BONUS} points for every maze you solve.</p></div>`,
  ],
  show_clickable_nav: true,
  button_label_previous: "Back",
  button_label_next: "Next",
  data: { task: "instructions" },
});

if (include("training")) timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `<div class="intro"><p>When you're ready, press the space bar to start the first maze.</p></div>`,
  choices: [" "],
});

// ---------------------------------------------------------------------------
// 3. Mazes
// ---------------------------------------------------------------------------
let score = START_POINTS;                       // carried through the whole study
const bushesIn = (rows) => rows.join("").split("B").length - 1;
let used = 0;
const trainingMazes = include("training") ? MAZES.slice(0, opts.mazes) : [];
if (!include("training")) {
  // Preview starting after the mazes: points as if all mazes had been played.
  score = START_POINTS + MAZES.length * MAZE_BONUS + mapping.reduce((s, m) => s + m.count * m.value, 0);
}

trainingMazes.forEach((rows, i) => {
  const n = bushesIn(rows);
  const items = plan.slice(used, used + n);     // this maze's share of the plan
  used += n;
  timeline.push({
    type: jsPsychMaze,
    maze: rows,
    encounters: items,
    start_score: () => score,                   // a function: read when the maze starts
    encounter_duration: 1500,
    completion_bonus: MAZE_BONUS,
    prompt: `<p>Maze ${i + 1} of ${MAZES.length}. Use the arrow keys to walk to the exit.</p>`,
    data: { task: "maze", maze_index: i + 1 },
    on_finish: (data) => { score = data.final_score; },
  });
});

// The mazes must hold exactly as many bushes as planned encounters (5 mazes, 83 bushes).
// If someone swaps in different mazes, stop with a clear message instead of running a broken study.
// (Previews may play fewer mazes on purpose.)
if (trainingMazes.length === MAZES.length && used !== plan.length) {
  throw new Error(`Mazes have ${used} bushes but ${plan.length} encounters are planned.`);
}

// ---------------------------------------------------------------------------
// 4. The question maze: a small maze with 3 bushes. At each bush the card asks
//    which animal first came to mind (free text, identical in both conditions),
//    then:  epistemic: a final guess (free text); 1 point if it's right.
//           action:    go through (win or lose that animal's points) or avoid.
//    Nothing is revealed in the maze; everything is shown on the results screen.
// ---------------------------------------------------------------------------
const TEST_BUSHES = TEST_MAZE.join("").split("B").length - 1;
// What's in each bush: drawn at random with the same frequencies as in the
// mazes (each of the 83 encounters equally likely), independently per bush.
const TEST_ITEMS = jsPsych.randomization.sampleWithReplacement(plan, TEST_BUSHES);

// Turn a typed answer into one of the eight animals, or "other". Handles case,
// articles, plurals, a few common alternatives, and small typos. Check the raw
// answers by hand before analysis; this coding is only used for scoring.
const ALIASES = { bunny: "rabbit", hare: "rabbit", tortoise: "turtle", mice: "mouse",
                  foxes: "fox", owlet: "owl", gecko: "lizard", chipmunk: "squirrel" };
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
function codeAnimal(text) {
  const words = String(text || "").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
  for (const w of words) {
    const singular = w.replace(/(es|s)$/, "");
    for (const cand of [w, singular]) {
      if (ANIMALS.includes(cand)) return cand;
      if (ALIASES[cand]) return ALIASES[cand];
    }
  }
  for (const w of words) {                      // small typos: "squirel", "turtel"
    const close = ANIMALS.filter((a) => editDistance(w, a) <= (a.length >= 6 ? 2 : 1));
    if (close.length === 1) return close[0];
  }
  return "other";
}

if (include("training")) timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => `<div class="intro"><p>You have ${total(score)} points after completing these mazes.</p>
                   <p>Press the space bar to continue.</p></div>`,
  choices: [" "],
  data: { task: "mazes_done" },
  on_finish: (data) => { data.score = score; },
});

const TEST_INSTRUCTIONS = CONDITION === "action"
  ? `<p>In this maze you can decide whether to go through the bush or avoid it.</p>
     <p>If you go through, you win or lose the points of the animal in the bush. If you avoid it,
        your points stay the same.</p>`
  : `<p>In this maze you can win points by guessing which animal is in the bush. The animals won't give
        or take points anymore. The only way to win points is to guess correctly which animal is in the bush.</p>
     <p>You win ${GUESS_POINTS} points for each correct guess.</p>`;
// Comprehension check: two questions after the instructions. If either answer is
// wrong, the participant sees a short note and reads the instructions again.
const CHECK = CONDITION === "action"
  ? [{ prompt: "In this maze, what happens if you go through a bush?",
       options: ["I win or lose the points of the animal in the bush",
                 "Nothing happens to my points",
                 "I win points if I guess the animal correctly"], correct: 0 },
     { prompt: "What happens if you avoid a bush?",
       options: ["I lose the points of the animal in the bush",
                 "My points stay the same",
                 "I win the points of the animal in the bush"], correct: 1 }]
  : [{ prompt: "In this maze, do the animals give or take away points?",
       options: ["Yes, I win or lose the points of the animal in the bush",
                 "No, the animals don't give or take away points in this maze"], correct: 1 },
     { prompt: "How can you win points in this maze?",
       options: ["By meeting animals that give points",
                 "By guessing correctly which animal is in the bush",
                 "By finishing the maze quickly"], correct: 1 }];
let checkAttempts = 0;
let checkPassed = false;
if (include("question")) timeline.push({
  timeline: [
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="intro">${TEST_INSTRUCTIONS}
                 <p>This maze has ${TEST_BUSHES} bushes. You will find out what was in them at the end of the task.</p></div>`,
      choices: ["Continue"],
      data: { task: "question_maze_instructions" },
    },
    {
      type: jsPsychSurveyMultiChoice,
      preamble: `<p class="check-title">Before you start, please answer these questions.</p>`,
      questions: CHECK.map((c, i) => ({ prompt: c.prompt, options: c.options, required: true, name: `q${i + 1}` })),
      button_label: "Continue",
      data: { task: "comprehension_check" },
      on_finish: (data) => {
        checkAttempts += 1;
        data.attempt = checkAttempts;
        data.correct = CHECK.map((c, i) => data.response[`q${i + 1}`] === c.options[c.correct]);
        checkPassed = data.correct.every(Boolean);
        data.passed = checkPassed;
      },
    },
    {
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="intro"><p>Not quite. Please read the instructions for this maze again.</p></div>`,
        choices: ["Read them again"],
        data: { task: "comprehension_retry" },
      }],
      conditional_function: () => !checkPassed,
    },
  ],
  loop_function: () => !checkPassed,
});

if (include("question")) timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `<div class="intro"><p>Thanks, that's right!</p><p>Press the space bar to start the maze.</p></div>`,
  choices: [" "],
  data: { task: "question_maze_start" },
});

let testRecords = [];
if (include("question")) timeline.push({
  type: jsPsychMaze,
  mode: "question",
  question_condition: CONDITION,
  maze: TEST_MAZE,
  encounters: TEST_ITEMS,
  show_score: false,                            // points from this maze are shown only at the end
  cell_size: 36,                                // bigger squares: the maze is small, and the question card must fit over it
  guess_prompt: CONDITION === "action"
    ? "Before you choose whether to go through or avoid the bush,<br><strong>guess what animal is in this bush.</strong>"
    : "<strong>Guess what animal is in this bush.</strong>",
  first_mention_prompt: `<strong>Which animal first came to your mind after seeing the bush?</strong><br>
    Even if it was not your final answer, write the first animal that popped into your mind when you saw the bush.`,
  decision_prompt: "Do you want to go through the bush or avoid it?",
  completion_message: "You reached the end of this maze!",
  prompt: `<p>Use the arrow keys to walk to the exit.</p>`,
  data: { task: "question_maze" },
  on_finish: (data) => {
    let points = 0;
    data.encounters.forEach((rec) => {
      rec.first_animal_coded = codeAnimal(rec.first_animal);
      rec.guess_coded = codeAnimal(rec.guess);
      rec.guess_correct = rec.guess_coded === rec.name;
      if (CONDITION === "action") {
        rec.points = rec.decision === "go_through" ? rec.value : 0;     // the guess isn't scored here
      } else {
        rec.points = rec.guess_correct ? GUESS_POINTS : 0;
      }
      points += rec.points;
    });
    data.question_points = points;
    data.final_score = score + points;
    score += points;
    testRecords = data.encounters;
  },
});

// ---------------------------------------------------------------------------
// 5. Final questions: how many points does each animal give or take away?
//    One animal at a time, in random order, guessed on a slider. Each correct
//    answer wins GUESS_POINTS. No feedback until the results screen.
// ---------------------------------------------------------------------------
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="intro">
      <p>Do you remember how many points each animal gave or took away?</p>
      <p>Now you will answer a couple of questions about the animals you encountered in the maze.
         Each correct answer wins you ${GUESS_POINTS} points!</p></div>`,
  choices: ["Continue"],
  data: { task: "value_questions_intro" },
});

const results = [];                              // one row per animal, for the results screen
jsPsych.randomization.shuffle(ANIMALS).forEach((animal, i) => {
  const row = { animal, value: valueOf[animal] };
  timeline.push({
    type: jsPsychHtmlSliderResponse,
    stimulus: `<div class="test"><img class="animal-img" src="${imgSrc(animal)}" alt="${animal}">
               <p>How many points does the <strong>${animal}</strong> give or take away? Move the slider to your guess.</p>
               <p class="guess" id="guess-readout"></p></div>`,
    min: -MAX_VALUE, max: MAX_VALUE, step: 1, slider_start: 0,
    labels: [`\u2212${MAX_VALUE}`, "0", `+${MAX_VALUE}`],
    slider_width: 560,
    require_movement: true,
    button_label: "Continue",
    data: { task: "animal_estimate", order: i + 1, animal, true_value: row.value },
    on_load: () => {
      const slider = document.getElementById("jspsych-html-slider-response-response");
      const readout = document.getElementById("guess-readout");
      slider.addEventListener("input", () => { readout.textContent = "Your guess: " + pointsText(Number(slider.value)); });
    },
    on_finish: (data) => {
      data.estimate = Number(data.response);
      data.correct = data.estimate === row.value;
      data.abs_error = Math.abs(data.estimate - row.value);
      data.points = data.correct ? GUESS_POINTS : 0;
      row.estimate = data.estimate;
      row.guessPoints = data.points;
      score += data.points;
      results.push(row);
    },
  });
});

// ---------------------------------------------------------------------------
// 6. Results: what was in the bush, each decision and guess, and the new total
// ---------------------------------------------------------------------------
const colored = (v) => `<span class="${v > 0 ? "gain" : v < 0 ? "loss" : ""}">${v === 0 ? "0" : signed(v)}</span>`;
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: () => {
    const testRows = testRecords.map((r, i) => `<tr><td>${i + 1}</td>
        <td>${CONDITION === "action" ? (r.decision === "go_through" ? "Went through" : "Avoided") : r.guess}</td>
        <td>${capitalize(r.name)} (${signed(r.value)})</td><td>${colored(r.points)}</td></tr>`).join("");
    const testPoints = testRecords.reduce((s, r) => s + r.points, 0);
    const rows = results.map((r) => `<tr><td>${capitalize(r.animal)}</td>
        <td>${signed(r.estimate) || "0"}</td><td>${signed(r.value)}</td><td>${colored(r.guessPoints)}</td></tr>`).join("");
    const fromGuesses = results.reduce((s, r) => s + r.guessPoints, 0);
    return `<div class="results">
      <h2>Your results</h2>
      ${testRecords.length ? `<p><strong>The last maze</strong></p>
      <table>
        <tr><th>Bush</th><th>${CONDITION === "action" ? "Your choice" : "Your answer"}</th><th>What was in it</th><th>Points</th></tr>
        ${testRows}
      </table>` : ""}
      <p><strong>How many points each animal gives or takes away</strong></p>
      <table>
        <tr><th>Animal</th><th>Your answer</th><th>Actual points</th><th>Points won</th></tr>
        ${rows}
      </table>
      <p>${testRecords.length ? `From the last maze: ${colored(testPoints)} points. ` : ""}From your answers about the animals:
         ${colored(fromGuesses)} points.</p>
      <p class="total">Your total: ${total(score)} points</p></div>`;
  },
  choices: ["Continue"],
  data: { task: "results" },
  on_finish: (data) => { data.final_score = score; },
});

// ---------------------------------------------------------------------------
// 7. End
// ---------------------------------------------------------------------------
timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => `<div class="intro"><p>You finished the task with ${total(score)} points.
                   Thank you for taking part!</p><p>Press the space bar to finish.</p></div>`,
  choices: [" "],
});

jsPsych.run(timeline);
}
