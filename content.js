// This script runs on every leetcode.com/problems/* page
// It listens for messages from popup.js asking for page data

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_PROBLEM") {
    const title = document.querySelector("[data-cy='question-title']")?.innerText
      || document.querySelector(".text-title-large")?.innerText
      || document.title;

    const description = document.querySelector("[data-key='description-content']")?.innerText
      || document.querySelector(".elfjS")?.innerText
      || "";

    sendResponse({ title, description });
  }

  if (request.type === "GET_CODE") {
    const lines = document.querySelectorAll(".view-line");
    const code = Array.from(lines).map(l => l.innerText).join("\n");
    sendResponse({ code });
  }

  return true; // keeps the message channel open for async response
});