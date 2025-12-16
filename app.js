/* ================= CONFIG ================= */

const HF_TOKEN = "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";
const HF_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

const levels = ["A1","A2","B1","B2","C1"];

/* ================= STATE ================= */

let stats = JSON.parse(localStorage.getItem("stats")) || {
  level: "A1", hits: 0, errors: 0
};
let strictMode = JSON.parse(localStorage.getItem("strictMode")) || false;
let history = JSON.parse(localStorage.getItem("history")) || [];

let lastUserText = "";
let lastAIReply = "";

/* ================= DOM ================= */

const englishText = document.getElementById("englishText");
const feedback = document.getElementById("feedback");
const levelText = document.getElementById("levelText");
const micBtn = document.getElementById("micBtn");
const askBtn = document.getElementById("askBtn");
const listenBtn = document.getElementById("listenBtn");
const strictBtn = document.getElementById("strictBtn");
const historyDiv = document.getElementById("history");

/* ================= INIT ================= */

updateUI();

/* ================= STT (Safari-safe) ================= */

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

  feedback.textContent = "🎙️ Listening…";

  rec.onresult = e => {
    lastUserText = e.results[0][0].transcript;
    englishText.textContent = `You said: ${lastUserText}`;
    feedback.textContent = "🟡 Ready to ask the AI";
  };

  rec.onerror = () => feedback.textContent = "⚠️ STT error";

  rec.start();
};

/* ================= ASK AI (manual trigger) ================= */

askBtn.onclick = async () => {
  if (!lastUserText) {
    feedback.textContent = "❌ Speak first";
    return;
  }

  feedback.textContent = "⏳ AI thinking… (Safari may block this)";
  listenBtn.disabled = true;

  try {
    const aiRaw = await askAI(lastUserText);
    const ai = parseAI(aiRaw);

    if (!ai.reply) throw new Error();

    lastAIReply = ai.reply;
    listenBtn.disabled = false;

    englishText.innerHTML = highlightDifferences(
      normalize(ai.correction),
      normalize(lastUserText)
    );

    const errors = (englishText.innerHTML.match(/bad/g) || []).length;

    if (errors === 0) {
      stats.hits++;
      adjustLevel(true);
    } else {
      stats.errors++;
      adjustLevel(false);
    }

    saveHistory(errors);
    updateUI();

    feedback.textContent = "✅ AI responded. Click 🔊 Listen.";

  } catch {
    feedback.textContent =
      "❌ AI unavailable on Safari right now. Try again later.";
  }
};

/* ================= TTS (natural as possible) ================= */

listenBtn.onclick = () => {
  if (!lastAIReply) return;

  const u = new SpeechSynthesisUtterance(lastAIReply);
  u.lang = "en-US";
  u.rate = 0.95;
  u.pitch = 1.0;

  // best US voices on iOS
  const voices = speechSynthesis.getVoices();
  u.voice =
    voices.find(v => v.name === "Samantha") ||
    voices.find(v => v.lang === "en-US") ||
    null;

  speechSynthesis.cancel();
  speechSynthesis.speak(u);
};

/* ================= AI CALL (robust) ================= */

async function askAI(text) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20000);

  const prompt = `
You are a VERY STRICT English teacher.
No praise.

Student level: ${stats.level}
User said: "${text}"

Format:
Correction:
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
    body: JSON.stringify({
      inputs: prompt,
      options: { wait_for_model: true }
    })
  });

  const data = await res.json();

  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
  if (data.generated_text) return data.generated_text;
  if (data.error) throw new Error(data.error);

  throw new Error("Invalid AI response");
}

/* ================= HELPERS ================= */

function parseAI(t) {
  const g = l =>
    (t.match(new RegExp(l + ":([\\s\\S]*?)(?=\\n[A-Z]|$)","i"))||[,""])[1].trim();
  return { correction: g("Correction"), reply: g("Reply"), level: g("Level") };
}

function normalize(t) {
  return t.toLowerCase().replace(/[^a-z']/g," ").replace(/\s+/g," ").trim();
}

function similarity(a,b){
  let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]===b[i])s++;
  return s/Math.max(a.length,b.length);
}

function highlightDifferences(correct, spoken) {
  const c = correct.split(" ");
  const s = spoken.split(" ");
  return c.map((w,i)=>{
    const sc = similarity(w, s[i]||"");
    if (sc>=0.85) return `<span>${w}</span>`;
    return `<span class="text-red-400 underline bad">${w}</span>`;
  }).join(" ");
}

function adjustLevel(success){
  let i = levels.indexOf(stats.level);
  if(success && i<levels.length-1) i++;
  if(!success && i>0) i--;
  stats.level = levels[i];
}

function saveHistory(errors){
  history.push({ date:new Date().toLocaleDateString(), level:stats.level, errors });
  localStorage.setItem("history",JSON.stringify(history));
  localStorage.setItem("stats",JSON.stringify(stats));
}

function updateUI(){
  levelText.textContent =
    `Level: ${stats.level} | Hits: ${stats.hits} | Errors: ${stats.errors}`;
  strictBtn.textContent = strictMode ? "😈 Strict ON" : "🙂 Strict OFF";
  historyDiv.innerHTML =
    "<strong>Progress</strong><br>" +
    history.slice(-5).map(h=>`• ${h.date} — ${h.level} — errors: ${h.errors}`).join("<br>");
}

strictBtn.onclick = ()=>{
  strictMode = !strictMode;
  localStorage.setItem("strictMode", strictMode);
  updateUI();
};
