chrome.runtime.onInstalled.addListener(() => {
  console.log("Peer Hint extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HINT") {
    const { apiUrl, body } = request;

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(data => {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          || "Couldn't get a hint. Try again.";
        sendResponse({ success: true, hint: text });
      })
      .catch(err => {
        console.error("API error:", err);
        sendResponse({ success: false, hint: "Couldn't get a hint. Try again." });
      });

    return true; // keeps channel open for async
  }
});