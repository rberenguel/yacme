// js/main.js

import { parseCompactFormat } from "./modules/parser.js";
import {
  updateDiagram,
  setIconMap,
  initSlideControls,
  setPresentMode,
  isPresentMode,
  hasSlides,
  goToSlide,
  getCurrentSlideIndex,
  getTotalSlides,
} from "./modules/diagram.js";
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
  updateDiagram(parseCompactFormat(compactDiagramData).nodes);
  initSlideControls(); // Initialize slide navigation buttons
  openLastFile();

  // Check URL parameters for auto-starting presentation mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("preso")) {
    // Small delay to ensure diagram is rendered and slides are loaded
    setTimeout(() => {
      if (hasSlides()) {
        setPresentMode(true);
      }
    }, 200);
  }
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
  // Present mode toggle (Cmd/Ctrl+Enter)
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    if (hasSlides()) {
      setPresentMode(!isPresentMode());
    }
  }
  // Escape to exit present mode
  if (e.key === "Escape" && isPresentMode()) {
    e.preventDefault();
    setPresentMode(false);
  }
  // Arrow keys for slide navigation in present mode
  if (isPresentMode()) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const currentIndex = getCurrentSlideIndex();
      if (currentIndex !== null && currentIndex > 0) {
        goToSlide(currentIndex - 1);
      }
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const currentIndex = getCurrentSlideIndex();
      const total = getTotalSlides();
      if (currentIndex !== null && currentIndex < total - 1) {
        goToSlide(currentIndex + 1);
      }
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
