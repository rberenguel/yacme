// js/modules/quiz.js

let quizInterval = null;
let quizState = "stopped"; // 'stopped', 'hiding', 'showing', 'revealed'
let quizElements = [];
let hiddenElement = null;
const HIDE_DURATION_MS = 500;

function getAllQuizElements() {
  const nodes = d3.selectAll("g.node").nodes();
  const links = d3.selectAll("g.link-label-group").nodes();
  return [...nodes, ...links].map((el) => d3.select(el));
}

function setLabelsVisibility(visible) {
  d3.selectAll(".label, .link-label").style("opacity", visible ? 1 : 0);
}

function highlightElement(element, highlight) {
  if (element) {
    element.classed("quiz-highlight", highlight);
  }
}

function showHiddenElement() {
  if (hiddenElement) {
    hiddenElement.selectAll(".label, .link-label").style("opacity", 1);
    highlightElement(hiddenElement, false);
    quizState = "revealed";
  }
}

function startQuizCycle() {
  setLabelsVisibility(false);
  highlightElement(hiddenElement, false);
  quizState = "hiding";

  quizInterval = setTimeout(() => {
    setLabelsVisibility(true);
    quizElements = getAllQuizElements();
    if (quizElements.length === 0) {
      stopQuizMode();
      return;
    }

    hiddenElement =
      quizElements[Math.floor(Math.random() * quizElements.length)];

    hiddenElement.selectAll(".label, .link-label").style("opacity", 0);
    highlightElement(hiddenElement, true);
    quizState = "showing";
  }, HIDE_DURATION_MS);
}

function handleQuizKeydown(e) {
  if (e.code === "Space") {
    e.preventDefault();
    if (quizState === "showing") {
      showHiddenElement();
    } else if (quizState === "revealed") {
      startQuizCycle();
    }
  }
}

export function stopQuizMode() {
  clearTimeout(quizInterval);
  setLabelsVisibility(true);
  highlightElement(hiddenElement, false);
  hiddenElement = null;
  quizState = "stopped";
  window.removeEventListener("keydown", handleQuizKeydown, true);
}

export function startQuizMode() {
  if (quizState !== "stopped") return;
  startQuizCycle();
  window.addEventListener("keydown", handleQuizKeydown, true);
}
