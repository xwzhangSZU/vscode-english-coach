const vscode = acquireVsCodeApi();
let state = { mode: "coach", tone: "natural", providerId: "", targetLanguage: "auto", watchEnabled: false, watchMode: "stage" };
let lastNative = "";

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
}

function setLoading() {
  $("native").textContent = "Coaching…";
  $("native").className = "native muted";
  $("why").textContent = "";
  $("resultActions").classList.add("hidden");
}

function showResult(msg) {
  if (msg.mode === "translate") {
    lastNative = msg.translation || "";
    $("native").textContent = lastNative;
    $("native").className = "native";
    $("why").textContent = "";
  } else {
    lastNative = msg.rewritten || "";
    $("native").textContent = lastNative;
    $("native").className = "native";
    $("why").textContent = msg.why || "";
  }
  $("resultActions").classList.toggle("hidden", !lastNative);
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
  else if (msg.type === "setText" || msg.type === "stage") { $("input").value = msg.text; if (msg.type === "stage") $("input").focus(); }
});

document.addEventListener("DOMContentLoaded", () => {
  $("coach").onclick = run;
  $("fromClipboard").onclick = () => send("fromClipboard", {});
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
  send("ready", {});
});
