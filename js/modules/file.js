import { set, get } from "../../libs/idb-keyval.js";
import { getEditorView } from "./editor.js";
import {
  getDiagramData,
  getTotalSlides,
  goToSlide,
  getCurrentSlideIndex,
} from "./diagram.js";
import { createStandaloneHTML } from "./html-exporter.js";

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

export async function newFile() {
  const editorView = getEditorView();

  try {
    const response = await fetch("examples/basic.cmap");
    const basicContent = await response.text();

    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: basicContent,
      },
    });
    fileHandle = null;
    currentFileName = "concept-map.cmap";
    set("lastFile", null);
    set("lastFileContent", basicContent);
    set("lastFileName", null);
  } catch (error) {
    console.error("Failed to load basic.cmap:", error);
    // Fallback to empty diagram
    const fallback = "Welcome Welcome to YACME!";
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: fallback,
      },
    });
    fileHandle = null;
    currentFileName = "concept-map.cmap";
    set("lastFile", null);
    set("lastFileContent", fallback);
    set("lastFileName", null);
  }
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
      markedContent,
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
      fetch("libs/marked.min.js").then((res) => res.text()),
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
      markedContent,
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

/**
 * Inline critical computed styles for SVG elements
 * Only inline the styles that are necessary for proper rendering
 */
function inlineAllStyles(element) {
  const computedStyle = window.getComputedStyle(element);

  // List of critical CSS properties to inline for SVG rendering
  const criticalProps = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-anchor",
    "dominant-baseline",
    "filter",
    "transform",
    "display",
    "visibility",
  ];

  let styleString = "";

  criticalProps.forEach((prop) => {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== "" && value !== "none" && value !== "normal") {
      styleString += `${prop}:${value};`;
    }
  });

  // Get existing inline style to preserve user-defined styles
  const existingStyle = element.getAttribute("style");
  if (existingStyle) {
    styleString = existingStyle + ";" + styleString;
  }

  if (styleString) {
    element.setAttribute("style", styleString);
  }

  // Recursively process children
  Array.from(element.children).forEach((child) => inlineAllStyles(child));
}

/**
 * Convert SVG to canvas by rendering it as an image with all styles and fonts inlined
 */
async function svgToCanvas(svgElement, width, height) {
  return new Promise(async (resolve, reject) => {
    try {
      // Clone the SVG to avoid modifying the original
      const svgClone = svgElement.cloneNode(true);

      // Set explicit dimensions
      svgClone.setAttribute("width", width);
      svgClone.setAttribute("height", height);

      // Load font files and CSS
      const [iconoirFontBlob, ostrichsansBase64Module, cssContent] =
        await Promise.all([
          fetch("fonts/iconoir/iconoir.woff2").then((res) => res.blob()),
          import("../../fonts/ostrichsans-base64.js"),
          fetch("style.css").then((res) => res.text()),
        ]);

      const iconoirFontBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(iconoirFontBlob);
      });

      // Remove @import statements from CSS (they don't work in embedded SVG)
      const cleanedCSS = cssContent.replace(/@import[^;]+;/g, "").trim();

      // Create embedded styles with fonts and all CSS rules
      const embeddedStyles = `
        @font-face {
          font-family: 'Iconoir';
          src: url('data:font/woff2;base64,${iconoirFontBase64}') format('woff2');
        }
        @font-face {
          font-family: 'Ostrich Sans Inline Medium';
          src: url('data:font/opentype;base64,${ostrichsansBase64Module.ostrichSansMediumBase64.replace(/\s/g, "")}') format('opentype');
        }
        @font-face {
          font-family: 'Ostrich Sans Inline Heavy';
          src: url('data:font/opentype;base64,${ostrichsansBase64Module.ostrichSansHeavyBase64.replace(/\s/g, "")}') format('opentype');
        }

        /* Set default font for SVG */
        svg {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        /* Embedded CSS for SVG rendering */
        ${cleanedCSS}
      `;

      // Add style tag with fonts and CSS to SVG
      const styleElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "style",
      );
      styleElement.textContent = embeddedStyles;
      svgClone.insertBefore(styleElement, svgClone.firstChild);

      // Serialize the SVG
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgClone);

      // Ensure proper XML namespaces
      if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgString = svgString.replace(
          "<svg",
          '<svg xmlns="http://www.w3.org/2000/svg"',
        );
      }

      // Create a blob from the SVG string
      const blob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      // Wait for fonts to be ready before creating image
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Create an image element
      const img = new Image();

      img.onload = () => {
        // Give a small delay for any final rendering
        setTimeout(() => {
          // Create canvas at 2x resolution for sharper output
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;

          const ctx = canvas.getContext("2d");

          // Fill background to match the presentation background
          ctx.fillStyle = "#111122"; // Dark blue-purple background
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the image at higher resolution
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          URL.revokeObjectURL(url);
          resolve(canvas);
        }, 100);
      };

      img.onerror = (err) => {
        console.error("Image load error:", err);
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG as image"));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render the entire diagram pane to canvas by drawing each SVG element manually
 * This approach handles foreignObject and all browser rendering
 */
async function renderDiagramToCanvas() {
  const diagramPane = document.querySelector(".diagram-pane");
  const svg = document.getElementById("diagram-container");

  if (!diagramPane || !svg) {
    throw new Error("Diagram pane or SVG not found");
  }

  const width = diagramPane.clientWidth;
  const height = diagramPane.clientHeight;

  // First try the SVG serialization approach
  try {
    const canvas = await svgToCanvas(svg, width, height);
    return canvas;
  } catch (error) {
    console.error("SVG serialization failed, trying alternate method:", error);

    // Fallback: Create canvas and manually draw visible content
    // This is a last resort and may not work perfectly
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Fill background
    ctx.fillStyle = "#002b36";
    ctx.fillRect(0, 0, width, height);

    // Return the canvas (user will see background only if both methods fail)
    return canvas;
  }
}

/**
 * Export all slides as PNG images bundled in a ZIP
 * Only available when in present mode
 */
export async function exportSlidesAsSVG() {
  try {
    const totalSlides = getTotalSlides();
    if (totalSlides === 0) {
      console.error("No slides to export");
      return;
    }

    const currentIndex = getCurrentSlideIndex();

    // Load JSZip
    const JSZip = window.JSZip;
    if (!JSZip) {
      console.error("JSZip library not loaded");
      return;
    }

    const zip = new JSZip();

    console.log(`Starting export of ${totalSlides} slides...`);

    // Iterate through all slides
    for (let i = 0; i < totalSlides; i++) {
      console.log(`Exporting slide ${i + 1}/${totalSlides}...`);

      // Navigate to the slide
      goToSlide(i);

      // Wait for animations to complete (fade-in is 400ms)
      await new Promise((resolve) => setTimeout(resolve, 600));

      try {
        // Render to canvas
        const canvas = await renderDiagramToCanvas();

        // Convert canvas to blob
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });

        // Add to ZIP with zero-padded filename
        const slideNumber = String(i + 1).padStart(3, "0");
        zip.file(`slide-${slideNumber}.png`, blob);
      } catch (error) {
        console.error(`Failed to export slide ${i + 1}:`, error);
      }
    }

    // Return to original slide
    if (currentIndex !== null) {
      goToSlide(currentIndex);
    }

    console.log("Generating ZIP file...");

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Download the ZIP
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "slides.zip";
    a.click();
    URL.revokeObjectURL(a.href);

    console.log(`Successfully exported ${totalSlides} slides as PNG files`);
  } catch (error) {
    console.error("Failed to export slides:", error);
  }
}
