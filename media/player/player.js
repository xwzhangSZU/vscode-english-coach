const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const audio = $("audio");
const myAudio = $("myaudio");
const SVG_NS = "http://www.w3.org/2000/svg";
const TONE = { fall: "↘", rise: "↗", "fall-rise": "↘↗", "rise-fall": "↗↘", level: "→" };
const TONE_LABEL = { fall: "fall", rise: "rise", "fall-rise": "fall-rise", "rise-fall": "rise-fall", level: "level" };

let lastSrc = null;
let mySrc = null;
let loopCfg = { count: 3, gap: 1 };
let abOn = false;

let pageSentences = []; // [{ index, text, status, notes, bodyEl, ipaEl, blockEl, wordEls }]
let activeIndex = -1; // global sentence index the controls act on
let total = 0;

let wordEls = []; // active sentence's word spans (for seek + playback highlight)
let timings = [];
let timingsEstimated = false;
let recording = false;
let playerConfig = {
  provider: "qwen",
  providers: [],
  analysisModels: {},
  ttsModels: {},
  voices: {},
};

function send(type, extra) { vscode.postMessage({ type, ...extra }); }

function clearAudio() {
  lastSrc = null;
  timings = [];
  timingsEstimated = false;
  clearHighlights();
  audio.removeAttribute("src");
  audio.load();
}

function fillSelect(id, options, selected) {
  const sel = $(id);
  sel.innerHTML = "";
  for (const option of options || []) {
    const opt = document.createElement("option");
    opt.value = option.id;
    opt.textContent = option.title || option.id;
    sel.appendChild(opt);
  }
  sel.value = selected;
}

function applyPlayerConfig(msg) {
  const selection = msg.selection || {};
  playerConfig = {
    provider: selection.provider || "qwen",
    providers: msg.providers || [],
    analysisModels: msg.analysisModels || {},
    ttsModels: msg.ttsModels || {},
    voices: msg.voices || {},
  };
  fillSelect("provider", playerConfig.providers, playerConfig.provider);
  fillSelect("analysisModel", playerConfig.analysisModels[playerConfig.provider], selection.analysisModel);
  fillSelect("ttsModel", playerConfig.ttsModels[playerConfig.provider], selection.ttsModel);
  fillSelect("voice", playerConfig.voices[playerConfig.provider], selection.voice);
}

function setPlayerConfig(key, value, provider) {
  clearAudio();
  send("setConfig", { key, value, provider: provider || playerConfig.provider });
}

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeSvg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toneY(tone, progress) {
  if (tone === "fall") return 24 + progress * 30;
  if (tone === "rise") return 54 - progress * 30;
  if (tone === "fall-rise") return 24 + Math.sin(progress * Math.PI) * 30;
  if (tone === "rise-fall") return 54 - Math.sin(progress * Math.PI) * 30;
  return 38;
}

function pointKind(token) {
  if (token.nuclear) return "nuclear";
  if (token.stressed) return "stressed";
  if (token.reduced) return "reduced";
  return "plain";
}

function fallbackPoints(row) {
  const tokens = row.tokens || [];
  const last = Math.max(tokens.length - 1, 1);
  return tokens.map((token, index) => {
    const progress = tokens.length === 1 ? 0.5 : index / last;
    const offset = token.nuclear ? -5 : token.stressed ? -3 : token.reduced ? 5 : 0;
    return {
      x: tokens.length === 1 ? 50 : 8 + progress * 84,
      y: clamp(toneY(row.tone, progress) + offset, 14, 62),
      kind: pointKind(token),
    };
  });
}

function pitchPath(points) {
  if (!points.length) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x - 6} ${p.y} L ${p.x + 6} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const p = points[i];
    const cx = (prev.x + p.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }
  return d;
}

// Smooth intonation contour only — the per-syllable stress is shown on the words below,
// so we no longer paint (distorted) dots on the stretched SVG.
function renderPitch(row) {
  const points = row.points && row.points.length ? row.points : fallbackPoints(row);
  const svg = makeSvg("svg", {
    class: "pitch",
    viewBox: "0 0 100 70",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
  });
  for (const y of [18, 34, 50, 66]) {
    svg.appendChild(makeSvg("line", { class: "staff-line", x1: 3, x2: 97, y1: y, y2: y }));
  }
  const path = pitchPath(points);
  svg.appendChild(makeSvg("path", { class: "contour-shadow", d: path }));
  svg.appendChild(makeSvg("path", { class: "contour", d: path }));
  return svg;
}

// Show the syllable split only when it actually reconstructs the word (guards against ugly splits).
function syllablesFor(token) {
  const syllables = Array.isArray(token.syllables) && token.syllables.length ? token.syllables : [token.text];
  const normalize = (value) => String(value || "").replace(/[^\p{L}\p{N}']/gu, "").toLowerCase();
  if (syllables.length > 1 && normalize(syllables.join("")) === normalize(token.text)) return syllables;
  return [token.text];
}

function renderWord(token, sentenceIndex, tokenIndex) {
  const kind = token.nuclear ? "nuclear" : token.stressed ? "stressed" : token.reduced ? "reduced" : "plain";
  const word = makeEl("span", "word " + kind);
  word.dataset.s = String(sentenceIndex);
  word.dataset.i = String(tokenIndex);

  const syllables = syllablesFor(token);
  const single = syllables.length <= 1;
  const stressIdx = typeof token.stressIndex === "number" ? token.stressIndex : -1;
  const sylRow = makeEl("span", "syl-row");
  syllables.forEach((sylText, i) => {
    const isStressSyl = token.stressed && (single || i === stressIdx);
    // ● marks the nuclear (sentence-focus) syllable; ˈ disambiguates which syllable is stressed in a
    // multi-syllable word. Monosyllabic non-nuclear words are just bolded — no extra mark, less clutter.
    const showMark = token.nuclear ? isStressSyl : isStressSyl && !single;
    const syl = makeEl("span", "syl" + (isStressSyl ? " stress" : ""));
    if (showMark) syl.appendChild(makeEl("span", "syl-mark", token.nuclear ? "●" : "ˈ"));
    syl.appendChild(makeEl("span", "syl-text", sylText));
    sylRow.appendChild(syl);
  });
  word.appendChild(sylRow);

  if (token.ipa) {
    word.appendChild(makeEl("span", "mini-ipa", token.ipa));
    word.title = `${token.text} ${token.ipa}`;
  } else {
    word.title = token.text;
  }
  if (token.link) {
    const link = makeEl("span", "link", "‿");
    link.title = `linking: ${token.link}`;
    word.appendChild(link);
  }
  word.addEventListener("click", (event) => onWordClick(event, sentenceIndex, tokenIndex));
  return word;
}

function renderGroups(rows, sentenceIndex) {
  const fragment = document.createDocumentFragment();
  const localWordEls = [];
  let runningIndex = 0;
  rows.forEach((row, ri) => {
    const group = makeEl("section", "group");
    const tokenCount = Math.max(1, (row.tokens || []).length);
    const groupWidth = Math.max(220, tokenCount * 56);
    group.style.setProperty("--tokens", String(tokenCount));
    group.style.setProperty("--group-width", `${groupWidth}px`);
    group.setAttribute("aria-label", `${row.toneLabel || TONE_LABEL[row.tone] || row.tone || "level"} thought group`);

    const head = makeEl("div", "group-head");
    const badge = makeEl("span", "tone-badge", `${row.toneMark || TONE[row.tone] || "→"} ${row.toneLabel || TONE_LABEL[row.tone] || "level"}`);
    badge.title = `intonation: ${row.toneLabel || row.tone || "level"}`;
    head.appendChild(badge);
    group.appendChild(head);
    group.appendChild(renderPitch(row));

    const wordRow = makeEl("div", "word-row");
    (row.tokens || []).forEach((token) => {
      const tokenIndex = runningIndex++;
      const word = renderWord(token, sentenceIndex, tokenIndex);
      localWordEls[tokenIndex] = word;
      wordRow.appendChild(word);
    });
    group.appendChild(wordRow);
    fragment.appendChild(group);
    if (ri < rows.length - 1) fragment.appendChild(makeEl("div", "gbar", "‖"));
  });
  return { fragment, wordEls: localWordEls };
}

function renderPage(msg) {
  total = msg.total || 0;
  activeIndex = typeof msg.activeIndex === "number" ? msg.activeIndex : msg.startIndex || 0;
  wordEls = [];
  clearAudio();
  pageSentences = (msg.sentences || []).map((s) => ({
    index: s.index,
    text: s.text,
    status: "pending",
    notes: "",
    bodyEl: null,
    ipaEl: null,
    blockEl: null,
    wordEls: [],
  }));

  const stave = $("stave");
  stave.innerHTML = "";
  if (!pageSentences.length) {
    stave.textContent = "Nothing to practice.";
    updatePos();
    return;
  }
  const fragment = document.createDocumentFragment();
  pageSentences.forEach((sentence) => {
    const block = makeEl("section", "sentence");
    block.dataset.index = String(sentence.index);
    if (sentence.index === activeIndex) block.classList.add("active");
    block.addEventListener("click", () => selectSentence(sentence.index));

    const head = makeEl("div", "sentence-head");
    head.appendChild(makeEl("span", "snum", String(sentence.index + 1)));
    head.appendChild(makeEl("span", "stext", sentence.text));
    block.appendChild(head);

    const body = makeEl("div", "sentence-body");
    body.textContent = "Analyzing…";
    sentence.bodyEl = body;
    block.appendChild(body);

    const ipa = makeEl("div", "sentence-ipa");
    sentence.ipaEl = ipa;
    block.appendChild(ipa);

    sentence.blockEl = block;
    fragment.appendChild(block);
  });
  stave.appendChild(fragment);
  $("notes").textContent = "";
  updatePos();
}

function applyAnalysis(msg) {
  const sentence = pageSentences.find((s) => s.index === msg.index);
  if (!sentence || !sentence.bodyEl) return;
  sentence.status = "ready";
  sentence.notes = msg.notes || "";
  sentence.bodyEl.innerHTML = "";
  if (!msg.rows || !msg.rows.length) {
    sentence.bodyEl.textContent = "No prosody data.";
    sentence.wordEls = [];
  } else {
    const { fragment, wordEls: localWordEls } = renderGroups(msg.rows, sentence.index);
    sentence.bodyEl.appendChild(fragment);
    sentence.wordEls = localWordEls;
  }
  if (sentence.ipaEl) sentence.ipaEl.textContent = msg.ipa || "";
  if (sentence.index === activeIndex) bindActive(sentence);
}

function bindActive(sentence) {
  wordEls = sentence.wordEls || [];
  $("notes").textContent = sentence.notes || "";
}

function selectSentence(index) {
  if (index === activeIndex) return;
  activeIndex = index;
  clearAudio();
  for (const sentence of pageSentences) {
    if (sentence.blockEl) sentence.blockEl.classList.toggle("active", sentence.index === index);
  }
  const sentence = pageSentences.find((s) => s.index === index);
  if (sentence) bindActive(sentence);
  updatePos();
  send("selectSentence", { index });
}

function onWordClick(event, sentenceIndex, tokenIndex) {
  event.stopPropagation();
  if (sentenceIndex !== activeIndex) {
    selectSentence(sentenceIndex);
    return;
  }
  seekWord(tokenIndex);
}

function updatePos() {
  const posEl = $("pos");
  if (posEl) posEl.textContent = total ? `${activeIndex + 1} / ${total}` : "";
}

function buildProportionalTimings(duration) {
  const totalDuration = Number.isFinite(duration) && duration > 0 ? duration : Math.max(1, wordEls.length);
  const step = totalDuration / Math.max(1, wordEls.length);
  return wordEls.map((_word, index) => ({ start: index * step, end: (index + 1) * step }));
}

function applyTimings(nextTimings, estimated) {
  timingsEstimated = Boolean(estimated);
  timings = Array.isArray(nextTimings) ? nextTimings : [];
  if (timingsEstimated && audio.duration) {
    timings = buildProportionalTimings(audio.duration);
  }
}

function seekWord(index) {
  const timing = timings[index];
  if (!timing || !lastSrc) return;
  audio.currentTime = timing.start;
  audio.play();
}

function clearHighlights() {
  for (const word of wordEls) word?.classList.remove("active");
}

function updateHighlight() {
  if (!timings.length || !wordEls.length) return;
  const current = audio.currentTime;
  const index = timings.findIndex((timing, i) => {
    const end = timing.end > timing.start ? timing.end : timings[i + 1]?.start ?? timing.start + 0.2;
    return current >= timing.start && current < end;
  });
  wordEls.forEach((word, i) => word.classList.toggle("active", i === index));
}

function setSpeed(v) {
  audio.preservesPitch = true;
  audio.playbackRate = v;
  $("speedVal").textContent = v.toFixed(2) + "×";
}
function playFromStart() { audio.currentTime = 0; audio.play(); }
function playOnce() { return new Promise((res) => { audio.onended = res; playFromStart(); }); }
function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }
async function runShadow() {
  const n = Math.max(1, Math.floor(loopCfg.count));
  for (let i = 0; i < n; i++) {
    await playOnce();
    if (i < n - 1) await wait(Math.max(0, loopCfg.gap) * 1000);
  }
  audio.onended = onAudioEnded;
}
function onAudioEnded() { if (abOn) playFromStart(); }

function setRecording(active) {
  recording = active;
  const record = $("record");
  if (record) {
    record.textContent = active ? "■ Stop" : "● Record";
    record.classList.toggle("on", active);
  }
}

function setMineEnabled(enabled) {
  for (const id of ["playMine", "compare", "exportMine"]) {
    const button = $(id);
    if (button) button.disabled = !enabled;
  }
}

function showFeedback(text) {
  const el = $("feedback");
  if (el) el.textContent = text || "";
}

function formatList(words) {
  return words && words.length ? words.join(", ") : "none";
}

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.type === "page") {
    renderPage(m);
  } else if (m.type === "analysis") {
    applyAnalysis(m);
  } else if (m.type === "audio") {
    lastSrc = m.src;
    audio.src = m.src;
    audio.onended = onAudioEnded;
    playFromStart();
  } else if (m.type === "timings") {
    applyTimings(m.timings, m.estimated);
  } else if (m.type === "error") {
    if (typeof m.index === "number") {
      const sentence = pageSentences.find((s) => s.index === m.index);
      if (sentence && sentence.bodyEl) {
        sentence.status = "error";
        sentence.bodyEl.textContent = "⚠ " + m.message;
      }
    } else {
      $("stave").textContent = "⚠ " + m.message;
    }
  } else if (m.type === "recording-started") {
    setRecording(true);
    showFeedback("Recording…");
  } else if (m.type === "recording") {
    mySrc = m.src;
    myAudio.src = mySrc;
    myAudio.load();
    setRecording(false);
    setMineEnabled(true);
    showFeedback("Your take is ready.");
  } else if (m.type === "recording-error") {
    setRecording(false);
    showFeedback("⚠ " + m.message);
  } else if (m.type === "feedback") {
    const percent = Math.round((m.coverage || 0) * 100);
    showFeedback(`Matched ${m.matched}/${m.total} (${percent}%) · missed: ${formatList(m.missed)} · extra: ${formatList(m.extra)}${m.tip ? " · " + m.tip : ""}`);
  } else if (m.type === "config") {
    loopCfg = { count: m.loopCount, gap: m.loopGap };
    $("shadow").textContent = `Shadow ×${m.loopCount}`;
    applyPlayerConfig(m);
  } else if (m.type === "audioCleared") {
    clearAudio();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  $("prev").onclick = () => send("pagePrev");
  $("next").onclick = () => send("pageNext");
  $("play").onclick = () => { if (lastSrc) playFromStart(); else send("synthesize", { teacher: false }); };
  $("teacher").onclick = () => send("synthesize", { teacher: true });
  $("repeat").onclick = () => { if (lastSrc) playFromStart(); };
  $("speed").oninput = (e) => setSpeed(Number(e.target.value));
  $("abrepeat").onclick = () => { abOn = !abOn; $("abrepeat").classList.toggle("on", abOn); };
  $("shadow").onclick = () => { if (lastSrc) runShadow(); else send("synthesize", { teacher: false }); };
  $("export").onclick = () => send("export");
  const record = $("record");
  if (record) record.onclick = () => send(recording ? "stopRecord" : "record");
  const playMine = $("playMine");
  if (playMine) playMine.onclick = () => { if (mySrc) myAudio.play(); };
  const compare = $("compare");
  if (compare) compare.onclick = () => send("compare");
  const exportMine = $("exportMine");
  if (exportMine) exportMine.onclick = () => send("exportMine");
  $("setKey").onclick = () => send("setApiKey");
  $("provider").onchange = (e) => setPlayerConfig("provider", e.target.value, e.target.value);
  $("analysisModel").onchange = (e) => setPlayerConfig("analysisModel", e.target.value);
  $("ttsModel").onchange = (e) => setPlayerConfig("ttsModel", e.target.value);
  $("voice").onchange = (e) => setPlayerConfig("voice", e.target.value);
  setSpeed(1);
  setMineEnabled(false);
  audio.addEventListener("timeupdate", updateHighlight);
  audio.addEventListener("ended", clearHighlights);
  audio.addEventListener("loadedmetadata", () => {
    if (timingsEstimated) applyTimings(timings, true);
  });
  send("ready");
});
