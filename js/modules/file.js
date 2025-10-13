import { set, get } from "../../libs/idb-keyval.js";
import { getEditorView } from "./editor.js";
import { getDiagramData } from "./diagram.js";
import { createStandaloneHTML } from "./html-exporter.js";

let fileHandle = null;

export async function openFile() {
  const editorView = getEditorView();
  [fileHandle] = await window.showOpenFilePicker({
    types: [
      {
        description: "Concept Maps",
        accept: {
          "text/cmap": [".cmap"],
          "text/markdown": [".md"],
        },
      },
    ],
  });
  const file = await fileHandle.getFile();
  const contents = await file.text();
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: contents,
    },
  });
  set("lastFile", fileHandle);
}

export async function saveFile() {
  const editorView = getEditorView();
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(editorView.state.doc.toString());
    await writable.close();
  } else {
    saveFileAs();
  }
}

export async function saveFileAs() {
  const editorView = getEditorView();
  fileHandle = await window.showSaveFilePicker({
    types: [
      {
        description: "Concept Maps",
        accept: {
          "text/cmap": [".cmap"],
          "text/markdown": [".md"],
        },
      },
    ],
  });
  set("lastFile", fileHandle);
  const writable = await fileHandle.createWritable();
  await writable.write(editorView.state.doc.toString());
  await writable.close();
}

export async function openLastFile() {
  get("lastFile").then(async (lastFile) => {
    if (lastFile) {
      if (
        (await lastFile.queryPermission({ mode: "readwrite" })) === "granted"
      ) {
        fileHandle = lastFile;
        const editorView = getEditorView();
        const file = await fileHandle.getFile();
        const contents = await file.text();
        editorView.dispatch({
          changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: contents,
          },
        });
      }
    }
  });
}

export function newFile() {
  const editorView = getEditorView();
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: "",
    },
  });
  fileHandle = null;
  set("lastFile", null);
}

export async function exportStandaloneHTML() {
  try {
    const diagramData = getDiagramData();

    // The data is already a deep copy from getDiagramData
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

    const handle = await window.showSaveFilePicker({
      types: [
        {
          description: "HTML Files",
          accept: { "text/html": [".html"] },
        },
      ],
      suggestedName: "concept-map.html",
    });

    const writable = await handle.createWritable();
    await writable.write(htmlContent);
    await writable.close();
  } catch (error) {
    console.error("Failed to export HTML:", error);
    // Optionally, inform the user that the export failed.
  }
}
