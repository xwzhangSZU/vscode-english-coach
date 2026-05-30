const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const audio = $("audio");
const TONE = { fall: "↘", rise: "↗", "fall-rise": "↘↗", "rise-fall": "↗↘", level: "→" };
let lastSrc = null;
let loopCfg = { count: 3, gap: 1 };
let abOn = false;

function send(type, extra) { vscode.postMessage({ type, ...extra }); }

function renderStave(rows) {
  const el = $("stave");
  el.innerHTML = "";
  rows.forEach((row, ri) => {
    const group = document.createElement("span");
    group.className = "group";
    row.tokens.forEach((t) => {
      const word = document.createElement("span");
      word.className = "word " + (t.nuclear ? "nuclear" : t.stressed ? "stressed" : "reduced");
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = t.stressed || t.nuclear ? "●" : "·";
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = t.text;
      if (t.ipa) word.title = t.ipa;
      word.appendChild(mark);
      word.appendChild(txt);
      group.appendChild(word);
      if (t.link) {
        const l = document.createElement("span");
        l.className = "link";
        l.textContent = "‿";
        group.appendChild(l);
      }
      group.appendChild(document.createTextNode(" "));
    });
    const tone = document.createElement("span");
    tone.className = "tone";
    tone.textContent = TONE[row.tone] || "";
    group.appendChild(tone);
    el.appendChild(group);
    if (ri < rows.length - 1) {
      const g = document.createElement("span");
      g.className = "gbar";
      g.textContent = " ‖ ";
      el.appendChild(g);
    }
  });
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

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.type === "loading") {
    $("pos").textContent = `${m.index + 1} / ${m.total}`;
    $("stave").textContent = "Analyzing…";
    $("ipa").textContent = "";
    $("notes").textContent = "";
    lastSrc = null;
  } else if (m.type === "analysis") {
    renderStave(m.rows);
    $("ipa").textContent = m.ipa || "";
    $("notes").textContent = m.notes || "";
    $("pos").textContent = `${m.index + 1} / ${m.total}`;
    lastSrc = null;
  } else if (m.type === "audio") {
    lastSrc = m.src;
    audio.src = m.src;
    audio.onended = onAudioEnded;
    playFromStart();
  } else if (m.type === "error") {
    $("stave").textContent = "⚠ " + m.message;
  } else if (m.type === "config") {
    loopCfg = { count: m.loopCount, gap: m.loopGap };
    $("shadow").textContent = `Shadow ×${m.loopCount}`;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  $("prev").onclick = () => send("prev");
  $("next").onclick = () => send("next");
  $("play").onclick = () => { if (lastSrc) playFromStart(); else send("synthesize", { teacher: false }); };
  $("teacher").onclick = () => send("synthesize", { teacher: true });
  $("repeat").onclick = () => { if (lastSrc) playFromStart(); };
  $("speed").oninput = (e) => setSpeed(Number(e.target.value));
  $("abrepeat").onclick = () => { abOn = !abOn; $("abrepeat").classList.toggle("on", abOn); };
  $("shadow").onclick = () => { if (lastSrc) runShadow(); else send("synthesize", { teacher: false }); };
  $("export").onclick = () => send("export");
  setSpeed(1);
  send("ready");
});
