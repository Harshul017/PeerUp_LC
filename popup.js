const API_KEY = "AIzaSyAcgSkOj3UwRrzf_Yrc3wA-N1qZXb_eopI";
const API_URL =  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${API_KEY}`;
const MAX_HINTS = 3;

let hints = [];
let useCode = false;

// ── on load ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  loadState();
  renderHints();
  detectProblem();

  document.getElementById("btn-next").addEventListener("click", getNextHint);
  document.getElementById("btn-reset").addEventListener("click", resetHints);
  document.getElementById("toggle").addEventListener("click", () => {
    useCode = !useCode;
    document.getElementById("toggle").classList.toggle("off", !useCode);
  });
});

// ── detect problem from the active tab ───────────────────
async function detectProblem() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  const match = url.match(/leetcode\.com\/problems\/([^/]+)/);
  if (match) {
    const name = match[1].replaceAll("-", " ");
    document.getElementById("problem-name").textContent =
      name.charAt(0).toUpperCase() + name.slice(1);
  } else {
    document.getElementById("problem-name").textContent = "Open a LeetCode problem";
  }
}

// ── get next hint via background.js ──────────────────────
async function getNextHint() {
  if (hints.length >= MAX_HINTS) return;

  const btn = document.getElementById("btn-next");
  btn.disabled = true;
  btn.textContent = "Thinking...";

  showLoading(true);

  const problemName = document.getElementById("problem-name").textContent;
  let code = "";

  if (useCode) {
    code = await getCodeFromPage();
  }

  const hintNumber = hints.length + 1;
  const prompt = buildPrompt(problemName, hintNumber, hints, code);

  try {
    const body = {
      contents: [
        {
          parts: [
            {
              text: `You are a peer tutor helping someone solve a LeetCode problem.
Give hint number ${hintNumber} of 3. Follow these rules strictly:
- Hint 1: Point to the right general thinking direction. No approach names.
- Hint 2: Name the data structure or technique. Ask a guiding question.
- Hint 3: Give a near-complete conceptual walkthrough. Still no code.
- Never write actual code.
- Be concise — 2 to 4 sentences max.
- Sound like a helpful peer, not a textbook.

${prompt}`
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.7
      }
    };

    // route through background.js to avoid CORS issues
    const response = await chrome.runtime.sendMessage({
      type: "GET_HINT",
      apiUrl: API_URL,
      body: body
    });

    const hintText = response?.hint || "Couldn't get a hint. Try again.";
    hints.push(hintText);
    saveState();
    showLoading(false);
    renderHints();

  } catch (err) {
    showLoading(false);
    console.error(err);
    alert("Something went wrong. Check your API key.");
  }

  btn.disabled = hints.length >= MAX_HINTS;
  btn.textContent = hints.length >= MAX_HINTS ? "All hints used" : "Next hint →";
}

// ── build the prompt ──────────────────────────────────────
function buildPrompt(problem, hintNumber, previousHints, code) {
  let prompt = `Problem: ${problem}\n`;
  prompt += `I need hint number ${hintNumber} of 3.\n`;

  if (previousHints.length > 0) {
    prompt += `\nHints already given:\n`;
    previousHints.forEach((h, i) => {
      prompt += `Hint ${i + 1}: ${h}\n`;
    });
    prompt += `\nDon't repeat the above. Build on them.\n`;
  }

  if (code && code.trim().length > 0) {
    prompt += `\nMy current code:\n${code}\n`;
    prompt += `Use my code to give a more relevant hint for where I'm actually stuck.\n`;
  }

  return prompt;
}

// ── grab code from the LeetCode editor ───────────────────
async function getCodeFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const lines = document.querySelectorAll(".view-line");
        return Array.from(lines).map(l => l.innerText).join("\n");
      }
    });
    return results?.[0]?.result || "";
  } catch {
    return "";
  }
}

// ── render hints to the UI ────────────────────────────────
function renderHints() {
  const container = document.getElementById("hints-container");
  const placeholder = document.getElementById("placeholder");
  container.innerHTML = "";

  if (hints.length === 0) {
    placeholder.style.display = "block";
  } else {
    placeholder.style.display = "none";
    hints.forEach((text, i) => {
      const isPrev = i < hints.length - 1;
      const card = document.createElement("div");
      card.className = "hint-card" + (isPrev ? " prev" : "");
      card.innerHTML = `
        <div class="hint-label">${isPrev ? "Hint " + (i + 1) + " — done" : "Hint " + (i + 1) + " — current"}</div>
        <div class="hint-text">${text}</div>
      `;
      container.appendChild(card);
    });
  }

  for (let i = 1; i <= MAX_HINTS; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.className = "hdot";
    if (i < hints.length + 1) dot.classList.add("done");
    else if (i === hints.length + 1) dot.classList.add("active");
  }

  document.getElementById("hint-counter").textContent =
    `${hints.length} of ${MAX_HINTS}`;

  const btn = document.getElementById("btn-next");
  btn.disabled = hints.length >= MAX_HINTS;
  btn.textContent = hints.length >= MAX_HINTS ? "All hints used" : "Get Hint →";
}

// ── loading state ─────────────────────────────────────────
function showLoading(show) {
  const container = document.getElementById("hints-container");
  const existing = document.getElementById("loading-msg");
  if (show) {
    if (!existing) {
      const el = document.createElement("div");
      el.id = "loading-msg";
      el.className = "loading-text";
      el.textContent = "Your peer is thinking...";
      container.appendChild(el);
    }
  } else {
    existing?.remove();
  }
}

// ── persist hints per problem ─────────────────────────────
function saveState() {
  const problem = document.getElementById("problem-name").textContent;
  chrome.storage.local.set({ [problem]: hints });
}

function loadState() {
  const problem = document.getElementById("problem-name").textContent;
  chrome.storage.local.get([problem], (result) => {
    hints = result[problem] || [];
    renderHints();
  });
}

// ── reset ─────────────────────────────────────────────────
function resetHints() {
  hints = [];
  saveState();
  document.getElementById("placeholder").style.display = "block";
  renderHints();
}