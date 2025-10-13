import { set, get } from "../../libs/idb-keyval.js";
import { getEditorView } from "./editor.js";

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
      if ((await lastFile.queryPermission({ mode: "readwrite" })) === "granted") {
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
