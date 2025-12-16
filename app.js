const chat = document.getElementById("chat");
const speakBtn = document.getElementById("speakBtn");
const levelEl = document.getElementById("level");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const modeBtn = document.getElementById("modeBtn");
const historyDiv = document.getElementById("history");

// ================= CONFIG =================
const HF_TOKEN = "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";
const HF_MODEL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";
// ==========================================

let level = localStorage.getItem("level") || "A1";
let strictMode = JSON.parse(localStorage.getItem("strictMode")) || false;
let history = JSON.parse(localStorage.getItem("history")) || [];

levelEl.textContent = `Level: ${level}`;
modeBtn.textContent = strictMode ? "😈 Strict mode: ON" : "🙂 Strict mode: OFF";

// ===== Detect Safari =====
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// ===== Speech Recognition =====
let recognition = null;
if (!isSafari && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
} else {
  speakBtn.disabled = true;
  speakBtn.textContent = "🎤 Voice not supported on Safari";
}

// ===== UI helpers =====
function addUserMessage(text) {
  const p = document.createElement("p");
  p.innerHTML = `<strong>You:</strong> ${text}`;
  p.className = "user";
  chat.appendChild(p);
}

function addBlock(title, html, cls) {
  const div = document.createElement("div");
  div.className = "block " + cls;
  div.innerHTML = `<strong>${title}</strong><p>${html}</p>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ===== TTS =====
function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ===== Token diff (heurística de pronúncia) =====
function highlightErrors(original, corrected) {
  const o = original.toLowerCase().split(/\s+/);
  const c = corrected.toLowerCase().split(/\s+/);

  return c
    .map(w => o.includes(w) ? w : `<span class="bad">${w}</span>`)
    .join(" ");
}

// ===== Parse AI =====
function parseAI(text) {
  const get = (l) =>
    (text.match(new RegExp(l + ":([\\s\\S]*?)(?=\\n[A-Z]|$)", "i")) || [,""])[1].trim();

  return {
    correction: get("Correction"),
    pronunciation: get("Pronunciation"),
    reply: get("Reply"),
    level: get("Level")
  };
}

// ===== AI Call =====
async function askAI(userText) {
  const prompt = `
You are a VERY STRICT English teacher.
No praise. Be direct and critical.

Student level: ${level}
Strict mode: ${strictMode}

User said: "${userText}"

1. Rewrite the sentence correctly.
2. Explicitly list mistakes.
3. Be concise.
4. Estimate CEFR level (A1-C1).

Format:
Correction:
Pronunciation:
Reply:
Level:
`;

  const res = await fetch(HF_MODEL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + HF_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt })
  });

  if (!res.ok) throw new Error();
  const data = await res.json();
  return data[0].generated_text;
}

// ===== History =====
function saveHistory(entry) {
  history.push(entry);
  localStorage.setItem("history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyDiv.innerHTML = "<h3>📈 Progress</h3>" +
    history.slice(-5).map(h =>
      `<p>${h.date} — Level ${h.level} — Errors: ${h.errors}</p>`
    ).join("");
}

// ===== Handle input =====
async function handleUserInput(text) {
  if (!text) return;

  addUserMessage(text);

  try {
    const raw = await askAI(text);
    const ai = parseAI(raw);

    const highlighted = highlightErrors(text, ai.correction);
    const errors = (highlighted.match(/bad/g) || []).length;

    addBlock("✏️ Correct sentence", highlighted, "correction");
    addBlock("🗣️ Pronunciation issues", ai.pronunciation, "pronunciation");
    addBlock("💬 Reply", ai.reply, "reply");
    speak(ai.reply);

    if (ai.level) {
      const trend = ai.level > level ? "↑" : ai.level < level ? "↓" : "→";
      level = ai.level;
      levelEl.textContent = `Level: ${level}`;
      localStorage.setItem("level", level);

      saveHistory({
        date: new Date().toLocaleDateString(),
        level,
        errors,
        trend
      });

      addBlock("📊 Level update", `${trend} ${level}`, "level");
    }
  } catch {
    addBlock("⚠️ Error", "AI unavailable.", "error");
  }
}

// ===== Events =====
if (recognition) {
  recognition.onresult = e => handleUserInput(e.results[0][0].transcript);
  speakBtn.onclick = () => recognition.start();
}

sendBtn.onclick = () => {
  const t = textInput.value.trim();
  textInput.value = "";
  handleUserInput(t);
};

modeBtn.onclick = () => {
  strictMode = !strictMode;
  localStorage.setItem("strictMode", strictMode);
  modeBtn.textContent = strictMode ? "😈 Strict mode: ON" : "🙂 Strict mode: OFF";
};

renderHistory();
