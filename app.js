document.addEventListener("DOMContentLoaded", () => {

  /* ================= CONFIG ================= */

  const WORKER_URL = "https://english-ai.xvbw97yrx9.workers.dev";
  const levels = ["A1","A2","B1","B2","C1"];

  /* ================= STATE ================= */

  let stats = JSON.parse(localStorage.getItem("stats")) || {
    level: "A1",
    score: [],
    hits: 0,
    errors: 0
  };

  let continuousMode = false;
  let listening = false;
  let recognition = null;

  /* ================= DOM ================= */

  const chat = document.getElementById("chat");
  const feedback = document.getElementById("feedback");
  const levelText = document.getElementById("levelText");
  const micBtn = document.getElementById("micBtn");
  const toggleModeBtn = document.getElementById("toggleModeBtn");

  /* ================= INIT ================= */

  updateUI();
  initChart();

  /* ================= STT SAFARI ================= */

  function startListening() {
    if (listening) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      feedback.textContent = "❌ Speech recognition not supported";
      return;
    }

    recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    listening = true;
    feedback.textContent = "🎙️ Listening…";

    recognition.onresult = e => {
      const text = e.results[0][0].transcript;
      addBubble("user", text);
      listening = false;
      handleAI(text);
    };

    recognition.onerror = () => {
      listening = false;
      feedback.textContent = "⚠️ Voice error";
    };

    recognition.start();
  }

  micBtn.onclick = startListening;

  /* ================= AI FLOW ================= */

  async function handleAI(text) {
    feedback.textContent = "🤖 AI responding…";

    try {
      const aiRaw = await askAI(text);
      const ai = parseAI(aiRaw);

      addBubble("ai", ai.reply);
      speak(ai.reply);

      updateScore(ai.level);
      updateUI();

      if (continuousMode) {
        setTimeout(startListening, 1500); // pausa automática
      }
    } catch {
      feedback.textContent = "❌ AI unavailable";
    }
  }

  async function askAI(text) {
    const prompt = `
You are a strict American English teacher.
Correct grammar and pronunciation.
Adapt difficulty to CEFR.

Student level: ${stats.level}
User said: "${text}"

Format:
Reply:
Level:
`;

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    return data.generated_text || data[0]?.generated_text;
  }

  function parseAI(t) {
    const g = l =>
      (t.match(new RegExp(l+":([\\s\\S]*?)(?=\\n[A-Z]|$)","i"))||["",""])[1].trim();
    return { reply: g("Reply"), level: g("Level") || stats.level };
  }

  /* ================= TTS ================= */

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

  /* ================= UI ================= */

  function addBubble(type, text) {
    const div = document.createElement("div");
    div.className =
      type === "user"
        ? "text-blue-400 mb-2"
        : "text-green-400 mb-2";
    div.textContent = (type === "user" ? "You: " : "AI: ") + text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  toggleModeBtn.onclick = () => {
    continuousMode = !continuousMode;
    toggleModeBtn.textContent =
      `🔁 Continuous: ${continuousMode ? "ON" : "OFF"}`;
  };

  function updateScore(newLevel) {
    if (levels.indexOf(newLevel) > levels.indexOf(stats.level)) {
      stats.level = newLevel;
      stats.hits++;
    } else {
      stats.errors++;
    }

    stats.score.push(levels.indexOf(stats.level));
    localStorage.setItem("stats", JSON.stringify(stats));
    updateChart();
  }

  function updateUI() {
    levelText.textContent =
      `Level: ${stats.level} | Hits: ${stats.hits} | Errors: ${stats.errors}`;
  }

  /* ================= CHART ================= */

  let chart;

  function initChart() {
    const ctx = document.getElementById("progressChart");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: stats.score.map((_, i) => i + 1),
        datasets: [{
          label: "CEFR Progress",
          data: stats.score,
          borderWidth: 2
        }]
      }
    });
  }

  function updateChart() {
    chart.data.labels.push(chart.data.labels.length + 1);
    chart.data.datasets[0].data = stats.score;
    chart.update();
  }

});
