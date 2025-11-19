import { set, get } from "../../libs/idb-keyval.js";
import { getEditorView } from "./editor.js";
import { getDiagramData } from "./diagram.js";
import { createStandaloneHTML } from "./html-exporter.js";
import { compactDiagramData } from "./initial-data.js";

let fileHandle = null;
let currentFileName = "concept-map.cmap";

async function saveContentToLocal() {
  const editorView = getEditorView();
  await set("lastFileContent", editorView.state.doc.toString());
}

export async function openFile() {
  const editorView = getEditorView();

  if (window.showOpenFilePicker) {
    try {
      [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Concept Maps",
            accept: { "text/plain": [".cmap"] },
          },
        ],
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
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const contents = await file.text();
      currentFileName = file.name;
      fileHandle = null;

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
  await saveContentToLocal();

  if (
    fileHandle &&
    (await fileHandle.queryPermission({ mode: "readwrite" })) === "granted"
  ) {
    const editorView = getEditorView();
    const writable = await fileHandle.createWritable();
    await writable.write(editorView.state.doc.toString());
    await writable.close();
  } else {
    saveFileAs();
  }
}

export async function saveFileAs() {
  await saveContentToLocal();
  const editorView = getEditorView();
  const content = editorView.state.doc.toString();

  // First, try the File System Access API
  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: currentFileName,
        types: [
          {
            description: "Concept Maps",
            accept: { "text/plain": [".cmap"] },
          },
        ],
      });
      currentFileName = fileHandle.name;
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      await set("lastFile", fileHandle);
      await set("lastFileName", currentFileName);
      return;
    } catch (err) {
      console.error("Save As cancelled or failed.", err);
      // If the user cancels, we should not proceed.
      return;
    }
  }

  const file = new File(
    [new Blob([content], { type: "text/plain" })],
    currentFileName,
    {
      type: "text/plain",
    },
  );

  // If that's not available, try the Web Share API
  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
      });
      return;
    } catch (err) {
      console.error("Share failed:", err);
      // Fallback to blob download if sharing fails
    }
  }

  // Finally, fall back to the blob download method
  const blob = new Blob([content], {
    type: "application/octet-stream",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);

  let baseName = currentFileName;
  if (baseName.includes(".")) {
    baseName = baseName.substring(0, baseName.lastIndexOf("."));
  }
  a.download = `${baseName}.cmap`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function openLastFile() {
  const editorView = getEditorView();
  const lastContent = await get("lastFileContent");
  if (lastContent) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: lastContent,
      },
    });
    currentFileName = (await get("lastFileName")) || "concept-map.cmap";
  }

  if (window.showOpenFilePicker) {
    const lastFileHandle = await get("lastFile");
    if (
      lastFileHandle &&
      (await lastFileHandle.queryPermission({ mode: "readwrite" })) ===
        "granted"
    ) {
      fileHandle = lastFileHandle;
    }
  }
}

export function newFile() {
  const editorView = getEditorView();
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: compactDiagramData,
    },
  });
  fileHandle = null;
  currentFileName = "concept-map.cmap";
  set("lastFile", null);
  set("lastFileContent", compactDiagramData);
  set("lastFileName", null);
}

export async function exportStandaloneHTML() {
  try {
    const editorView = getEditorView();
    const diagramText = editorView.state.doc.toString(); // Get the raw text content

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

    const [
      d3Content,
      dagreContent,
      cssContent,
      diagramJsContent,
      quizJsContent,
      parserJsContent,
      iconoirCssContent,
      iconoirFontBlob,
      ostrichsansCssContent,
      ostrichsansBase64Module,
    ] = await Promise.all([
      fetch("libs/d3v7.js").then((res) => res.text()),
      fetch("libs/dagre.js").then((res) => res.text()),
      fetch("style.css").then((res) => res.text()),
      fetch("js/modules/diagram.js").then((res) => res.text()),
      fetch("js/modules/quiz.js").then((res) => res.text()),
      fetch("js/modules/parser.js").then((res) => res.text()),
      fetch("fonts/iconoir/iconoir-font.css").then((res) => res.text()),
      fetch("fonts/iconoir/iconoir.woff2").then((res) => res.blob()),
      fetch("fonts/ostrichsans.css").then((res) => res.text()),
      import("../../fonts/ostrichsans-base64.js"),
    ]);

    // Convert font to base64 for embedding
    const fontBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(iconoirFontBlob);
    });

    // Replace the font URL with inline base64 data
    const inlinedIconoirCss = iconoirCssContent.replace(
      /url\("\.\/iconoir\.woff2"\)/g,
      `url("data:font/woff2;base64,${fontBase64}")`,
    );

    // Create inline CSS for OstrichSans fonts with base64 data
    // Strip newlines from base64 strings to prevent CSS parsing issues
    const mediumBase64 =
      ostrichsansBase64Module.ostrichSansMediumBase64.replace(/\s/g, "");
    const heavyBase64 = ostrichsansBase64Module.ostrichSansHeavyBase64.replace(
      /\s/g,
      "",
    );

    const inlinedOstrichsansCss = ostrichsansCssContent
      .replace(
        /url\("\.\/OstrichSans-Medium\.otf"\)/g,
        `url("data:font/opentype;base64,${mediumBase64}")`,
      )
      .replace(
        /url\("\.\/OstrichSans-Heavy\.otf"\)/g,
        `url("data:font/opentype;base64,${heavyBase64}")`,
      );

    const htmlContent = createStandaloneHTML(
      exportData,
      d3Content,
      dagreContent,
      diagramJsContent,
      cssContent,
      quizJsContent,
      parserJsContent,
      inlinedIconoirCss,
      diagramText,
      inlinedOstrichsansCss,
    );

    if (window.showSaveFilePicker) {
      try {
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
        return;
      } catch (err) {
        console.error("HTML export save cancelled or failed", err);
        return;
      }
    }

    const file = new File(
      [new Blob([htmlContent], { type: "text/html" })],
      "concept-map.html",
      {
        type: "text/html",
      },
    );

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
        });
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
    }

    const blob = new Blob([htmlContent], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "concept-map.html";
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (error) {
    console.error("Failed to export HTML:", error);
  }
}
