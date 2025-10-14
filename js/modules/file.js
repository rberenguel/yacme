import { set, get } from "../../libs/idb-keyval.js";
import { getEditorView } from "./editor.js";
import { getDiagramData } from "./diagram.js";
import { createStandaloneHTML } from "./html-exporter.js";

let fileHandle = null;
let currentFileName = "concept-map.cmap";

// Helper to save the current editor content to IndexedDB for session persistence
async function saveContentToLocal() {
  const editorView = getEditorView();
  await set("lastFileContent", editorView.state.doc.toString());
  console.log("Session saved locally.");
}

export async function openFile() {
  const editorView = getEditorView();

  if (window.showOpenFilePicker) {
    try {
      [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'Concept Maps',
          accept: { 'text/plain': ['.cmap'] }
        }],
      });
      const file = await fileHandle.getFile();
      const contents = await file.text();
      currentFileName = file.name;

      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: contents },
      });

      await set("lastFile", fileHandle);
      await set("lastFileName", currentFileName);
      await saveContentToLocal();
    } catch (err) {
      console.error("File open cancelled or failed.", err);
    }
  } else {
    // Fallback for iOS and other unsupported browsers
    const input = document.createElement("input");
    input.type = "file";
    // Hint to iOS what file types we are interested in.
    input.accept = ".cmap,text/plain";
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const contents = await file.text();
      currentFileName = file.name;
      fileHandle = null; // Reset fileHandle for non-picker APIs

      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: contents },
      });
      
      await set("lastFileName", currentFileName);
      await saveContentToLocal();
    };
    input.click();
  }
}

export async function saveFile() {
  // Always save the current state to IndexedDB for session persistence
  await saveContentToLocal();
  const editorView = getEditorView();

  // Use File System Access API if handle exists and permissions are granted
  if (fileHandle && (await fileHandle.queryPermission({ mode: "readwrite" })) === "granted") {
    const writable = await fileHandle.createWritable();
    await writable.write(editorView.state.doc.toString());
    await writable.close();
  } else {
    // Otherwise, fall back to the download method
    saveFileAs();
  }
}

export async function saveFileAs() {
  await saveContentToLocal();
  const editorView = getEditorView();

  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: currentFileName,
        types: [{
          description: 'Concept Maps',
          accept: { 'text/plain': ['.cmap'] },
        }],
      });
      currentFileName = fileHandle.name;
      const writable = await fileHandle.createWritable();
      await writable.write(editorView.state.doc.toString());
      await writable.close();
      await set("lastFile", fileHandle);
      await set("lastFileName", currentFileName);
    } catch (err) {
      console.error("Save As cancelled or failed.", err);
    }
  } else {
    // Fallback for iOS: trigger a download
    const blob = new Blob([editorView.state.doc.toString()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = currentFileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

export async function openLastFile() {
  const editorView = getEditorView();
  // On any browser, try to load the last content from IndexedDB.
  const lastContent = await get("lastFileContent");
  if (lastContent) {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: lastContent },
    });
    currentFileName = (await get("lastFileName")) || "concept-map.cmap";
  }
  
  // For browsers with File System Access API, try to re-acquire the handle
  if (window.showOpenFilePicker) {
    const lastFileHandle = await get("lastFile");
    if (lastFileHandle && (await lastFileHandle.queryPermission({ mode: "readwrite" })) === "granted") {
      fileHandle = lastFileHandle;
    }
  }
}

export function newFile() {
  const editorView = getEditorView();
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: "" },
  });
  fileHandle = null;
  currentFileName = "concept-map.cmap";
  // Clear the session state
  set("lastFile", null);
  set("lastFileContent", "");
  set("lastFileName", null);
}

export async function exportStandaloneHTML() {
  try {
    const diagramData = getDiagramData();
    const exportData = {
      nodes: diagramData.nodes,
      links: diagramData.links.map((link) => ({
        source: link.source.id,
        target: link.target.id,
        verb: link.verb,
        directives: link.directives,
      })),
    };

    const [d3Content, dagreContent, cssContent, diagramJsContent] =
      await Promise.all([
        fetch("libs/d3v7.js").then((res) => res.text()),
        fetch("libs/dagre.js").then((res) => res.text()),
        fetch("style.css").then((res) => res.text()),
        fetch("js/modules/diagram.js").then((res) => res.text()),
      ]);

    const htmlContent = createStandaloneHTML(
      exportData,
      d3Content,
      dagreContent,
      diagramJsContent,
      cssContent,
    );

    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        types: [{
          description: "HTML Files",
          accept: { "text/html": [".html"] },
        }],
        suggestedName: "concept-map.html",
      });
      const writable = await handle.createWritable();
      await writable.write(htmlContent);
      await writable.close();
    } else {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "concept-map.html";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (error) {
    console.error("Failed to export HTML:", error);
  }
}