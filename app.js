/* =====================================================
   CONFIG
===================================================== */

const WORKER_URL = "https://english-ai.xvbw97yrx9.workers.dev/";
const levels = ["A1", "A2", "B1", "B2", "C1"];

/* =====================================================
   STATE
===================================================== */

let stats = JSON.parse(localStorage.getItem("stats")) || {
  level: "A1",
  hits: 0,
  errors: 0
};

let history = JSON.parse(localStorage.getItem("history")) || [];

let lastUserText = "";

/* =====================================================
   DOM
===================================================== */

const englishText = document.getElementById("englishText");
const feedback = document.getElementById("feedback");
const levelText = document.getElementById("levelText");

const micBtn = document.getElementById("micBtn");
const askBtn = document.getElementById("askBtn");
const historyDiv = document.getElementById("history");

/* =====================================================
   INIT
===================================================== */

updateUI();

/* =====================================================
   STT — SAFARI SAFE
===================================================== */

micBtn.onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    feedback.textContent = "❌ Speech recognition not supported";
    return;
  }

  const rec = new SR();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  feedback.textContent = "🎙️ Listening…";

  rec.onresult = e => {
    lastUserText = e.results[0][0].transcript;
    englishText.textContent = `You said: ${lastUserText}`;
    feedback.textContent = "🟡 Ready for AI response";
  };

  rec.onerror = () => {
    feedback.textContent = "⚠️ Voice recognition error";
  };

  rec.start();
};

/* =====================================================
   ASK IA + TTS (no mesmo clique)
===================================================== */

askBtn.onclick = async () => {
  if (!lastUserText) {
    feedback.textContent = "❌ Speak first";
    return;
  }

  feedback.textContent = "🤖 AI responding…";

  try {
    const aiRaw = await askAI(lastUserText);
    const ai = parseAI(aiRaw);

    if (!ai.correction || !ai.reply) {
      throw new Error("Invalid AI response");
    }

    // Pronúncia / correção visual
    englishText.innerHTML = highlightDifferences(
      normalize(ai.correction),
      normalize(lastUserText)
    );

    const errorCount = (englishText.innerHTML.match(/bad/g) || []).length;

    if (errorCount === 0) {
      stats.hits++;
      adjustLevel(true);
      feedback.textContent = "✅ Good. Listen to the correction.";
    } else {
      stats.errors++;
      adjustLevel(false);
      feedback.textContent = `❌ ${errorCount} issues. Listen carefully.`;
    }

    saveHistory(errorCount);
    updateUI();

    // 🔊 TTS — permitido porque está no clique do botão
    speak(ai.reply);

  } catch (e) {
    feedback.textContent = "❌ AI unavailable. Try again.";
  }
};

/* =====================================================
   TTS — voz americana mais natural (iOS)
===================================================== */

function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  u.pitch = 1.0;

  const voices = speechSynthesis.getVoices();
  u.voice =
    voices.find(v => v.name === "Samantha") ||
    voices.find(v => v.lang === "en-US") ||
    null;

  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* =====================================================
   IA — via Cloudflare Worker
===================================================== */

async function askAI(text) {
  const prompt = `
You are a VERY STRICT English teacher.
No praise.

Student level: ${stats.level}
User said: "${text}"

Tasks:
1. Rewrite the sentence correctly.
2. Explain errors briefly.
3. Reply naturally.
4. Estimate CEFR level (A1-C1).

Format:
Correction:
Reply:
Level:
`;

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) throw new Error("Worker failed");

  const data = await res.json();

  if (Array.isArray(data) && data[0]?.generated_text)
    return data[0].generated_text;

  if (data.generated_text)
    return data.generated_text;

  throw new Error("Invalid AI response");
}

/* =====================================================
   PARSER
===================================================== */

function parseAI(text) {
  const get = l =>
    (text.match(new RegExp(l + ":([\\s\\S]*?)(?=\\n[A-Z]|$)", "i")) || ["",""])[1].trim();

  return {
    correction: get("Correction"),
    reply: get("Reply"),
    level: get("Level")
  };
}

/* =====================================================
   PRONÚNCIA — HEURÍSTICA
===================================================== */

function normalize(t) {
  return t.toLowerCase().replace(/[^a-z']/g, " ").replace(/\s+/g, " ").trim();
}

function similarity(a, b) {
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    if (a[i] === b[i]) same++;
  return same / Math.max(a.length, b.length);
}

function highlightDifferences(correct, spoken) {
  const c = correct.split(" ");
  const s = spoken.split(" ");

  return c.map((w, i) => {
    const score = similarity(w, s[i] || "");
    if (score >= 0.85) return `<span>${w}</span>`;
    return `<span class="text-red-400 underline bad">${w}</span>`;
  }).join(" ");
}

/* =====================================================
   CEFR ADAPTATIVO
===================================================== */

function adjustLevel(success) {
  let i = levels.indexOf(stats.level);
  if (success && i < levels.length - 1) i++;
  if (!success && i > 0) i--;
  stats.level = levels[i];
}

/* =====================================================
   HISTÓRICO
===================================================== */

function saveHistory(errors) {
  history.push({
    date: new Date().toLocaleDateString(),
    level: stats.level,
    errors
  });

  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("stats", JSON.stringify(stats));
}

/* =====================================================
   UI
===================================================== */

function updateUI() {
  levelText.textContent =
    `Level: ${stats.level} | Hits: ${stats.hits} | Errors: ${stats.errors}`;

  historyDiv.innerHTML =
    "<strong>📈 Progress</strong><br>" +
    history.slice(-5).map(
      h => `• ${h.date} — ${h.level} — errors: ${h.errors}`
    ).join("<br>");
}
