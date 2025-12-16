const chat = document.getElementById("chat");
const speakBtn = document.getElementById("speakBtn");
const levelEl = document.getElementById("level");

let level = localStorage.getItem("level") || "A1";

levelEl.textContent = `Level: ${level}`;

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = "en-US";

function addMessage(text, cls) {
  const p = document.createElement("p");
  p.textContent = text;
  p.className = cls;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}

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

  const res = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer hf_hf_XiOxCCBRZnNqxuyqmHPMmXyWAHsLyJTyBB",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: prompt })
    }
  );

  const data = await res.json();
  return data[0].generated_text;
}

recognition.onresult = async (e) => {
  const text = e.results[0][0].transcript;
  addMessage("You: " + text, "user");

  const aiText = await askAI(text);
  addMessage("AI: " + aiText, "ai");
  speak(aiText);

  const match = aiText.match(/Level:\s*(A1|A2|B1|B2|C1)/);
  if (match) {
    level = match[1];
    localStorage.setItem("level", level);
    levelEl.textContent = `Level: ${level}`;
  }
};

speakBtn.onclick = () => recognition.start();
