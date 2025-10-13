import { parseCompactFormat } from "./modules/parser.js";
import { updateDiagram } from "./modules/diagram.js";
import { setupEditor } from "./modules/editor.js";
import { openFile, saveFile, saveFileAs, openLastFile, newFile } from "./modules/file.js";
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
});