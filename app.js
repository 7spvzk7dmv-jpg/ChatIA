document.addEventListener("DOMContentLoaded", () => {

  /* ================= CONFIG ================= */

  const WORKER_URL = "https://english-ai.xvbw97yrx9.workers.dev";

  const levels = ["A1", "A2", "B1", "B2", "C1"];

  /* ================= STATE ================= */

  let stats = JSON.parse(localStorage.getItem("stats")) || {
    level: "A1",
    hits: 0,
    errors: 0
  };

  let lastUserText = "";

  /* ================= DOM ================= */

  const chat = document.getElementById("chat");
  const feedback = document.getElementById("feedback");
  const levelText = document.getElementById("levelText");

  const micBtn = document.getElementById("micBtn");
  const askBtn = document.getElementById("askBtn");
  const resetBtn = document.getElementById("resetBtn");

  updateUI();

  /* ================= STT — PADRÃO SAFARI ================= */

  micBtn.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      feedback.textContent = "Speech recognition not supported.";
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    feedback.textContent = "Listening…";

    rec.onresult = e => {
      lastUserText = e.results[0][0].transcript;
      addMessage("You", lastUserText);
      feedback.textContent = "Now click “Ask AI”.";
    };

    rec.onerror = () => {
      feedback.textContent = "Voice recognition error.";
    };

    rec.start(); // ⚠️ não mover
  });

  /* ================= ASK AI ================= */

  askBtn.addEventListener("click", async () => {
    if (!lastUserText) {
      feedback.textContent = "Speak first.";
      return;
    }

    feedback.textContent = "AI thinking…";

    try {
      const aiText = await askAI(lastUserText);
      addMessage("AI", aiText);

      speak(aiText);

      stats.hits++;
      saveStats();
      updateUI();

      feedback.textContent = "Your turn.";
    } catch {
      feedback.textContent = "AI unavailable.";
    }
  });

  /* ================= RESET ================= */

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset conversation and progress?")) return;

    stats = { level: "A1", hits: 0, errors: 0 };
    lastUserText = "";
    chat.innerHTML = "";
    saveStats();
    updateUI();
    feedback.textContent = "Progress reset.";
  });

  /* ================= HELPERS ================= */

  function askAI(text) {
    const prompt = `
You are an American English teacher.
Be clear and direct.

Student level: ${stats.level}
User said: "${text}"

Reply naturally.
`;

    return fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d[0]?.generated_text) return d[0].generated_text;
        if (d.generated_text) return d.generated_text;
        throw new Error();
      });
  }

  function speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;

    const voices = speechSynthesis.getVoices();
    u.voice =
      voices.find(v => v.name === "Samantha") ||
      voices.find(v => v.lang === "en-US") ||
      null;

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function addMessage(author, text) {
    const p = document.createElement("p");
    p.textContent = `${author}: ${text}`;
    p.className = author === "You" ? "text-blue-400 mb-1" : "text-green-400 mb-1";
    chat.appendChild(p);
    chat.scrollTop = chat.scrollHeight;
  }

  function updateUI() {
    levelText.textContent =
      `Level: ${stats.level} | Hits: ${stats.hits} | Errors: ${stats.errors}`;
  }

  function saveStats() {
    localStorage.setItem("stats", JSON.stringify(stats));
  }

});
