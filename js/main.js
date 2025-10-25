// js/main.js

import { parseCompactFormat } from "./modules/parser.js";
import { updateDiagram, setIconMap } from "./modules/diagram.js";
import { setupEditor } from "./modules/editor.js";
import {
  openFile,
  saveFile,
  saveFileAs,
  openLastFile,
  newFile,
  exportStandaloneHTML,
} from "./modules/file.js";
import { compactDiagramData } from "./modules/initial-data.js";
import { loadIconMap } from "./modules/icon-map-loader.js";
import { startQuizMode, stopQuizMode } from "./modules/quiz.js";

async function initializeApp() {
  const iconMap = await loadIconMap();
  setIconMap(iconMap); // Pass the dynamically loaded map to the diagram module

  setupEditor(compactDiagramData);
  updateDiagram(parseCompactFormat(compactDiagramData));
  openLastFile();
}

initializeApp();

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveFile();
  }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
    e.preventDefault();
    saveFileAs();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "o") {
    e.preventDefault();
    openFile();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "n") {
    e.preventDefault();
    newFile();
  }
  if (e.metaKey && !e.ctrlKey && e.key === "e") {
    e.preventDefault();
    exportStandaloneHTML();
  }
  // This is the new keybinding for the quiz mode
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "q") {
    e.preventDefault();
    const container = document.querySelector(".container");
    const isViewOnly = container.classList.toggle("view-only");
    if (isViewOnly) {
      startQuizMode();
    } else {
      stopQuizMode();
    }
  }
});

import { resizeDiagram } from "./modules/diagram.js";

const editorPane = document.getElementById("editor-pane");
const resizer = document.getElementById("resizer");

// --- Drag-to-resize Logic ---
function handleMouseDown(e) {
  e.preventDefault();
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
}

function handleMouseMove(e) {
  // Use clientX for horizontal position and set the editor's width
  editorPane.style.width = `${e.clientX}px`;
}

function handleMouseUp() {
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
}

resizer.addEventListener("mousedown", handleMouseDown);

// --- Diagram Resize Observer ---
const diagramPane = document.querySelector(".diagram-pane");
const observer = new ResizeObserver(() => {
  resizeDiagram();
});
observer.observe(diagramPane);
