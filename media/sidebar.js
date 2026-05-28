const vscode = acquireVsCodeApi();
let state = { mode: "coach", tone: "natural", providerId: "", targetLanguage: "auto", watchEnabled: false, watchMode: "stage" };
let lastNative = "";
let currentEntryId = null;
let currentStarred = false;
let reviewCards = [];
let reviewIdx = 0;

const $ = (id) => document.getElementById(id);

function send(type, payload) { vscode.postMessage({ type, ...payload }); }

function applyState() {
  $("mode").value = state.mode;
  $("tone").value = state.tone;
  $("provider").value = state.providerId;
  $("targetLanguage").value = state.targetLanguage;
  $("watchEnabled").checked = state.watchEnabled;
  $("watchMode").value = state.watchMode;
  const translate = state.mode === "translate";
  $("toneRow").classList.toggle("hidden", translate);
  $("langRow").classList.toggle("hidden", !translate);
  $("whyWrap").classList.toggle("hidden", translate);
  $("diffWrap").classList.toggle("hidden", translate);
  $("coach").textContent = translate ? "Translate (⌘↵)" : "Coach (⌘↵)";
}

function setLoading() {
  $("native").textContent = state.mode === "translate" ? "Translating…" : "Coaching…";
  $("native").className = "native muted";
  $("why").textContent = "";
  $("resultActions").classList.add("hidden");
}

function wordDiff(a, b) {
  const A = a.trim().split(/\s+/).filter(Boolean);
  const B = b.trim().split(/\s+/).filter(Boolean);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: "same", w: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "del", w: A[i] }); i++; }
    else { out.push({ t: "ins", w: B[j] }); j++; }
  }
  while (i < n) out.push({ t: "del", w: A[i++] });
  while (j < m) out.push({ t: "ins", w: B[j++] });
  return out;
}

function renderDiff(source, rewritten) {
  const el = $("diff");
  el.innerHTML = "";
  if (!source) return;
  for (const part of wordDiff(source, rewritten)) {
    const span = document.createElement("span");
    span.className = part.t;
    span.textContent = part.w + " ";
    el.appendChild(span);
  }
}

function showResult(msg) {
  currentEntryId = msg.entryId || null;
  currentStarred = false;
  if (msg.mode === "translate") {
    lastNative = msg.translation || "";
    $("native").textContent = lastNative;
    $("native").className = "native";
    $("why").textContent = "";
    $("diff").textContent = "";
  } else {
    lastNative = msg.rewritten || "";
    $("native").textContent = lastNative;
    $("native").className = "native";
    $("why").textContent = msg.why || "";
    renderDiff(msg.source || "", lastNative);
  }
  $("resultActions").classList.toggle("hidden", !lastNative);
  updateStar();
}

function updateStar() {
  const btn = $("star");
  btn.textContent = currentStarred ? "✅ 已收藏" : "⭐ 收藏";
  btn.classList.toggle("hidden", !currentEntryId);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startReview(cards) {
  reviewCards = shuffle((cards || []).slice());
  reviewIdx = 0;
  const empty = reviewCards.length === 0;
  $("reviewReveal").classList.toggle("hidden", empty);
  $("reviewNext").classList.toggle("hidden", empty);
  $("reviewGotit").classList.toggle("hidden", empty);
  if (empty) {
    $("reviewProgress").textContent = "";
    $("reviewSource").textContent = "还没有收藏的句子。在教练结果里点 ⭐ 收藏,再来复习。";
    $("reviewAnswer").classList.add("hidden");
  } else {
    showReviewCard();
  }
  $("reviewWrap").classList.remove("hidden");
}

function showReviewCard() {
  const c = reviewCards[reviewIdx];
  $("reviewProgress").textContent = `(${reviewIdx + 1}/${reviewCards.length})`;
  $("reviewSource").textContent = c.source;
  $("reviewNative").textContent = c.output;
  $("reviewWhy").textContent = c.why || "";
  $("reviewAnswer").classList.add("hidden");
}

function reviewNext() {
  if (!reviewCards.length) return;
  reviewIdx = (reviewIdx + 1) % reviewCards.length;
  showReviewCard();
}

function showError(msg) {
  $("native").className = "native error";
  $("native").textContent = msg.message || "Something went wrong.";
  $("why").textContent = "";
  $("resultActions").classList.add("hidden");
  if (msg.action) {
    const btn = document.createElement("button");
    btn.textContent = "Set API key";
    btn.onclick = () => send("setApiKey", {});
    $("native").appendChild(document.createElement("br"));
    $("native").appendChild(btn);
  }
}

function run() {
  const text = $("input").value;
  if (!text.trim()) return;
  if (state.mode === "translate") {
    send("translate", { text, targetLang: state.targetLanguage, providerId: state.providerId });
  } else {
    send("coach", { text, tone: state.tone, providerId: state.providerId });
  }
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "init") {
    state = msg.state;
    const sel = $("provider");
    sel.innerHTML = "";
    for (const p of msg.providers) {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.title;
      sel.appendChild(opt);
    }
    if (!state.providerId && msg.providers[0]) state.providerId = msg.providers[0].id;
    applyState();
  } else if (msg.type === "loading") setLoading();
  else if (msg.type === "result") showResult(msg);
  else if (msg.type === "error") showError(msg);
  else if (msg.type === "restore") {
    const e = msg.entry;
    state.mode = e.kind === "translate" ? "translate" : "coach";
    applyState();
    send("setState", { key: "mode", value: state.mode });
    $("input").value = e.source;
    if (state.mode === "translate") showResult({ mode: "translate", translation: e.output });
    else showResult({ mode: "coach", rewritten: e.output, why: e.why, source: e.source });
  } else if (msg.type === "review") startReview(msg.cards);
  else if (msg.type === "setText" || msg.type === "stage") { $("input").value = msg.text; if (msg.type === "stage") $("input").focus(); }
});

document.addEventListener("DOMContentLoaded", () => {
  $("coach").onclick = run;
  $("fromClipboard").onclick = () => send("fromClipboard", {});
  $("setKey").onclick = () => send("setApiKey", {});
  $("copy").onclick = () => send("copy", { text: lastNative });
  $("read").onclick = () => send("readAloud", { text: lastNative, slow: false });
  $("readSlow").onclick = () => send("readAloud", { text: lastNative, slow: true });
  $("input").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); });
  $("mode").onchange = (e) => { state.mode = e.target.value; applyState(); send("setState", { key: "mode", value: state.mode }); };
  $("tone").onchange = (e) => { state.tone = e.target.value; send("setState", { key: "tone", value: state.tone }); };
  $("provider").onchange = (e) => { state.providerId = e.target.value; send("setState", { key: "providerId", value: state.providerId }); };
  $("targetLanguage").onchange = (e) => { state.targetLanguage = e.target.value; send("setState", { key: "targetLanguage", value: state.targetLanguage }); };
  $("watchEnabled").onchange = (e) => { state.watchEnabled = e.target.checked; send("toggleWatch", { enabled: state.watchEnabled }); };
  $("watchMode").onchange = (e) => { state.watchMode = e.target.value; send("setState", { key: "watchMode", value: state.watchMode }); };
  $("star").onclick = () => { if (!currentEntryId) return; currentStarred = !currentStarred; send("star", { id: currentEntryId }); updateStar(); };
  $("reviewReveal").onclick = () => $("reviewAnswer").classList.remove("hidden");
  $("reviewNext").onclick = reviewNext;
  $("reviewExit").onclick = () => $("reviewWrap").classList.add("hidden");
  $("reviewGotit").onclick = () => {
    const c = reviewCards[reviewIdx];
    if (!c) return;
    send("star", { id: c.id });
    reviewCards.splice(reviewIdx, 1);
    if (!reviewCards.length) { $("reviewWrap").classList.add("hidden"); return; }
    if (reviewIdx >= reviewCards.length) reviewIdx = 0;
    showReviewCard();
  };
  send("ready", {});
});
