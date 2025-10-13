import { parseCompactFormat } from "./modules/parser.js";
import { updateDiagram } from "./modules/diagram.js";
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

setupEditor(compactDiagramData);
updateDiagram(parseCompactFormat(compactDiagramData));
openLastFile();

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
  if ((e.metaKey || e.ctrlKey) && e.key === "e") {
    e.preventDefault();
    exportStandaloneHTML();
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
// This will automatically update the D3 canvas when the pane is resized
const diagramPane = document.querySelector(".diagram-pane");
const observer = new ResizeObserver(() => {
  resizeDiagram();
});
observer.observe(diagramPane);
