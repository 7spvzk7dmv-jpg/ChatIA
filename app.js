const chat = document.getElementById("chat");
const levelEl = document.getElementById("level");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const listenBtn = document.getElementById("listenBtn");
const modeBtn = document.getElementById("modeBtn");
const historyDiv = document.getElementById("history");

// ===== CONFIG =====
const HF_TOKEN = "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";
const HF_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

// ===== STATE =====
let level = localStorage.getItem("level") || "A1";
let strict = JSON.parse(localStorage.getItem("strict")) || false;
let history = JSON.parse(localStorage.getItem("history")) || [];
let lastReply = "";

levelEl.textContent = `Level: ${level}`;
modeBtn.textContent = strict ? "😈 Strict ON" : "🙂 Strict OFF";

// ===== UI =====
function add(html) {
  const div = document.createElement("div");
  div.className = "mb-2";
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ===== TTS (ONLY on click) =====
listenBtn.onclick = () => {
  if (!lastReply) return;
  const u = new SpeechSynthesisUtterance(lastReply);
  u.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
};

// ===== AI =====
async function askAI(text) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20000);

  const prompt = `
You are a VERY STRICT English teacher.
No praise.

Student level: ${level}
User said: "${text}"

Format:
Correction:
Mistakes:
Reply:
Level:
`;

  const res = await fetch(HF_URL, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Authorization": "Bearer " + HF_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt })
  });

  if (!res.ok) throw new Error("AI failed");
  const data = await res.json();
  return data[0].generated_text;
}

// ===== Parse =====
function parse(label, text) {
  const r = new RegExp(label + ":([\\s\\S]*?)(?=\\n[A-Z]|$)", "i");
  return (text.match(r) || [,""])[1].trim();
}

// ===== HISTORY =====
function save(level, errors) {
  history.push({
    date: new Date().toLocaleDateString(),
    level,
    errors
  });
  localStorage.setItem("history", JSON.stringify(history));
  historyDiv.innerHTML = history.slice(-5)
    .map(h => `📅 ${h.date} — ${h.level} — errors: ${h.errors}`)
    .join("<br>");
}

// ===== SEND =====
sendBtn.onclick = async () => {
  const text = textInput.value.trim();
  if (!text) return;
  textInput.value = "";

  add(`<div class="text-blue-400">You: ${text}</div>`);
  listenBtn.disabled = true;

  try {
    const raw = await askAI(text);

    const correction = parse("Correction", raw);
    const mistakes = parse("Mistakes", raw);
    const reply = parse("Reply", raw);
    const newLevel = parse("Level", raw);

    lastReply = reply;
    listenBtn.disabled = false;

    add(`<div class="border-l-4 border-blue-500 pl-2">✏️ ${correction}</div>`);
    add(`<div class="border-l-4 border-yellow-500 pl-2">⚠️ ${mistakes}</div>`);
    add(`<div class="border-l-4 border-green-500 pl-2">💬 ${reply}</div>`);

    if (newLevel) {
      level = newLevel;
      localStorage.setItem("level", level);
      levelEl.textContent = `Level: ${level}`;
      save(level, mistakes ? mistakes.split(",").length : 0);
    }
  } catch {
    add(`<div class="text-red-500">⚠️ AI unavailable (Safari limitation)</div>`);
  }
};

// ===== STRICT MODE =====
modeBtn.onclick = () => {
  strict = !strict;
  localStorage.setItem("strict", strict);
  modeBtn.textContent = strict ? "😈 Strict ON" : "🙂 Strict OFF";
};
