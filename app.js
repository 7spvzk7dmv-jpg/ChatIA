/* =======================
   CONFIG
======================= */

const HF_TOKEN = "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";
const HF_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

/* =======================
   STATE
======================= */

let stats = JSON.parse(localStorage.getItem("stats")) || {
  level: 'A1',
  hits: 0,
  errors: 0
};

let strictMode = JSON.parse(localStorage.getItem("strictMode")) || false;
let history = JSON.parse(localStorage.getItem("history")) || [];

/* =======================
   DOM
======================= */

const englishText = document.getElementById("englishText");
const feedback = document.getElementById("feedback");
const levelText = document.getElementById("levelText");
const micBtn = document.getElementById("micBtn");
const strictBtn = document.getElementById("strictBtn");
const historyDiv = document.getElementById("history");

/* =======================
   INIT
======================= */

updateUI();

/* =======================
   STT — PADRÃO SAFARI
======================= */

micBtn.onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    feedback.textContent = "❌ Speech recognition not supported";
    return;
  }

  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  feedback.textContent = "🎙️ Listening…";

  rec.onresult = (e) => {
    const spoken = e.results[0][0].transcript;
    handleSpeech(spoken);
  };

  rec.onerror = () => {
    feedback.textContent = "⚠️ Speech recognition error";
  };

  rec.start(); // ⚠️ nunca mover
};

/* =======================
   CORE LOGIC
======================= */

async function handleSpeech(spokenText) {
  englishText.textContent = `You said: ${spokenText}`;

  const aiRaw = await askAI(spokenText);
  const ai = parseAI(aiRaw);

  const highlighted = highlightDifferences(
    normalize(ai.correction),
    normalize(spokenText)
  );

  englishText.innerHTML = highlighted;
  attachWordListeners();

  const errorCount = (highlighted.match(/bad/g) || []).length;

  if (errorCount === 0) {
    feedback.textContent = "✅ Acceptable pronunciation";
    stats.hits++;
    adjustLevel(true);
  } else {
    feedback.textContent = `❌ ${errorCount} pronunciation issues`;
    stats.errors++;
    adjustLevel(false);
  }

  saveHistory(errorCount);
  updateUI();
}

/* =======================
   AI
======================= */

async function askAI(text) {
  const prompt = `
You are a VERY STRICT English teacher.
No praise. Be direct.

Student level: ${stats.level}
Strict mode: ${strictMode}

User said: "${text}"

Tasks:
1. Rewrite the sentence correctly.
2. Be concise.
3. Estimate CEFR level (A1-C1).

Format:
Correction:
Reply:
Level:
`;

  const res = await fetch(HF_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + HF_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt })
  });

  const data = await res.json();
  return data[0].generated_text;
}

function parseAI(text) {
  const get = (l) =>
    (text.match(new RegExp(l + ":([\\s\\S]*?)(?=\\n[A-Z]|$)", "i")) || [,""])[1].trim();

  return {
    correction: get("Correction"),
    reply: get("Reply"),
    level: get("Level")
  };
}

/* =======================
   PRONUNCIATION HEURISTIC
======================= */

function normalize(t) {
  return t.toLowerCase().replace(/[^a-z']/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    if (a[i] === b[i]) same++;
  return same / Math.max(a.length, b.length);
}

function highlightDifferences(correct, spoken) {
  const c = correct.split(' ');
  const s = spoken.split(' ');

  return c.map((w, i) => {
    const score = similarity(w, s[i] || '');
    if (score >= 0.85) return `<span>${w}</span>`;

    const cls =
      score >= 0.5
        ? 'text-yellow-400 underline cursor-pointer bad'
        : 'text-red-400 underline cursor-pointer bad';

    return `<span class="${cls}" data-word="${w}">${w}</span>`;
  }).join(' ');
}

function attachWordListeners() {
  document.querySelectorAll('[data-word]').forEach(el => {
    el.onclick = () => speakWord(el.dataset.word);
  });
}

function speakWord(word) {
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* =======================
   CEFR ADAPTATIVO
======================= */

function adjustLevel(success) {
  let i = levels.indexOf(stats.level);
  if (success && i < levels.length - 1) i++;
  if (!success && i > 0) i--;
  stats.level = levels[i];
}

/* =======================
   HISTORY
======================= */

function saveHistory(errors) {
  history.push({
    date: new Date().toLocaleDateString(),
    level: stats.level,
    errors
  });

  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("stats", JSON.stringify(stats));
}

function renderHistory() {
  historyDiv.innerHTML =
    "<strong>📈 Progress</strong><br>" +
    history.slice(-5).map(h =>
      `• ${h.date} — ${h.level} — errors: ${h.errors}`
    ).join("<br>");
}

/* =======================
   UI
======================= */

function updateUI() {
  levelText.textContent =
    `Level: ${stats.level} | Hits: ${stats.hits} | Errors: ${stats.errors}`;

  strictBtn.textContent = strictMode ? "😈 Strict ON" : "🙂 Strict OFF";
  renderHistory();
}

strictBtn.onclick = () => {
  strictMode = !strictMode;
  localStorage.setItem("strictMode", strictMode);
  updateUI();
};
