const chat = document.getElementById("chat");
const speakBtn = document.getElementById("speakBtn");
const levelEl = document.getElementById("level");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");

// ================= CONFIG =================
const HF_TOKEN = "hf_hf_sTEYLpcgajhmYyTjtcOWfgeReGRWLjxoOB"; // ⬅️ coloque o token LOCALMENTE
const HF_MODEL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";
// ==========================================

let level = localStorage.getItem("level") || "A1";
levelEl.textContent = `Level: ${level}`;

// ===== Detect Safari =====
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// ===== Speech Recognition (only if supported) =====
let recognition = null;

if (!isSafari && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
} else {
  speakBtn.disabled = true;
  speakBtn.textContent = "🎤 Voice not supported on Safari";
}

// ===== UI helpers =====
function addBlock(title, text, cls) {
  const wrapper = document.createElement("div");
  wrapper.className = "block " + cls;

  const h = document.createElement("strong");
  h.textContent = title;

  const p = document.createElement("p");
  p.textContent = text;

  wrapper.appendChild(h);
  wrapper.appendChild(p);
  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
}

function addUserMessage(text) {
  const p = document.createElement("p");
  p.textContent = "You: " + text;
  p.className = "user";
  chat.appendChild(p);
}

// ===== TTS (Safari-safe) =====
function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// ===== Parse AI response =====
function parseAI(text) {
  const get = (label) => {
    const match = text.match(new RegExp(label + ":([\\s\\S]*?)(?=\\n[A-Z]|$)", "i"));
    return match ? match[1].trim() : "";
  };

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
You are an English teacher.
Student level: ${level}
User said: "${userText}"

1. Correct grammar if needed.
2. Point pronunciation problems.
3. Reply naturally.
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

  if (!res.ok) throw new Error("AI request failed");

  const data = await res.json();
  return data[0].generated_text;
}

// ===== Handle input =====
async function handleUserInput(text) {
  if (!text) return;

  addUserMessage(text);

  try {
    const aiRaw = await askAI(text);
    const ai = parseAI(aiRaw);

    if (ai.correction)
      addBlock("✏️ Correction", ai.correction, "correction");

    if (ai.pronunciation)
      addBlock("🗣️ Pronunciation", ai.pronunciation, "pronunciation");

    if (ai.reply) {
      addBlock("💬 Reply", ai.reply, "reply");
      speak(ai.reply);
    }

    if (ai.level) {
      level = ai.level;
      localStorage.setItem("level", level);
      levelEl.textContent = `Level: ${level}`;
      addBlock("📊 Level Update", level, "level");
    }
  } catch (e) {
    addBlock("⚠️ Error", "Could not contact the AI.", "error");
  }
}

// ===== Voice input (non-Safari) =====
if (recognition) {
  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    handleUserInput(text);
  };

  speakBtn.onclick = () => recognition.start();
}

// ===== Text input (Safari fallback) =====
sendBtn.onclick = () => {
  const text = textInput.value.trim();
  textInput.value = "";
  handleUserInput(text);
};
