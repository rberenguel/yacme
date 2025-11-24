import {
  EditorState,
  EditorView,
  keymap,
  defaultKeymap,
  history,
  historyKeymap,
  markdown,
  oneDark,
  languages,
  markdownLanguage,
  GFM,
  Decoration,
  ViewPlugin,
} from "CodeMirrorBundle";
import { parseCompactFormat, computeCumulativeSlides } from "./parser.js";
import {
  updateDiagram,
  setSlideContext,
  cacheFullNodeData,
  isPresentMode,
} from "./diagram.js";

let editorView;
let currentParsedData = null;

// --- Highlighting Logic using a ViewPlugin ---

const highlightPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = Decoration.none;
    }

    update(update) {
      // This is a placeholder; we will update decorations from outside.
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

const highlightTheme = EditorView.baseTheme({
  ".cm-highlight": { backgroundColor: "rgba(255, 255, 0, 0.2)" },
});

export function setupEditor(initialDoc) {
  const editorPane = document.getElementById("editor-pane");
  editorView = new EditorView({
    state: EditorState.create({
      doc: initialDoc.trim(),
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          extensions: [GFM],
        }),
        oneDark,
        EditorView.lineWrapping,
        highlightPlugin,
        highlightTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            try {
              const docText = update.state.doc.toString();
              const parsedData = parseCompactFormat(docText);
              currentParsedData = parsedData;

              // Compute cumulative slides if slides exist
              let cumulativeSlides = null;
              if (parsedData.slides) {
                cumulativeSlides = computeCumulativeSlides(
                  parsedData.slides,
                  parsedData.nodes,
                );
              }

              // Determine which slide the cursor is in
              let currentSlideIndex = null;
              if (cumulativeSlides) {
                const cursorLine = update.state.doc.lineAt(
                  update.state.selection.main.head,
                ).number;
                for (let i = 0; i < cumulativeSlides.length; i++) {
                  const slide = cumulativeSlides[i];
                  if (
                    cursorLine >= slide.lineStart &&
                    cursorLine <= slide.lineEnd
                  ) {
                    currentSlideIndex = i;
                    break;
                  }
                }
                // If cursor is after all slides, show the last slide
                if (currentSlideIndex === null && cumulativeSlides.length > 0) {
                  const lastSlide =
                    cumulativeSlides[cumulativeSlides.length - 1];
                  if (cursorLine > lastSlide.lineEnd) {
                    currentSlideIndex = cumulativeSlides.length - 1;
                  }
                }
              }

              // Cache the full node data for slide switching
              cacheFullNodeData(parsedData.nodes);

              // Update diagram with slide context
              // When in present mode, update the slides data but keep the current slide index
              if (update.docChanged) {
                if (isPresentMode()) {
                  // In present mode: update slides data but preserve current slide index
                  setSlideContext(cumulativeSlides, undefined); // undefined = keep current index
                } else {
                  // Not in present mode: update slides based on cursor position
                  setSlideContext(cumulativeSlides, currentSlideIndex);
                }
                updateDiagram(parsedData.nodes);
              } else if (
                update.selectionSet &&
                currentSlideIndex !== null &&
                !isPresentMode()
              ) {
                // Cursor moved, update slide preview (only when not in present mode)
                setSlideContext(cumulativeSlides, currentSlideIndex);
                updateDiagram(parsedData.nodes);
              }
            } catch (e) {
              console.error("Error parsing diagram text:", e);
            }
          }
        }),
      ],
    }),
    parent: editorPane,
  });
  return editorView;
}

export function getEditorView() {
  return editorView;
}

export function getCurrentParsedData() {
  return currentParsedData;
}

export function highlightNodeInEditor(nodeId) {
  const editor = getEditorView();
  const doc = editor.state.doc;
  const decorations = [];

  // Helper to strip prefixes like !, +, ~, *, -
  const stripPrefixes = (str) => str.replace(/^[!+~*-]+/, "");

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmedLine = line.text.trim();

    if (trimmedLine.includes("->")) {
      const [sourcePart, targetPart] = trimmedLine
        .split("->")
        .map((s) => s.trim());
      const sourceId = stripPrefixes(sourcePart.split(/\s+/)[0]);
      const targetId = stripPrefixes(targetPart.split(/\s+/)[0]);
      if (sourceId === nodeId || targetId === nodeId) {
        decorations.push(
          Decoration.line({ class: "cm-highlight" }).range(line.from),
        );
      }
    } else if (trimmedLine.startsWith("#")) {
      const proseNodeId = trimmedLine.split("#").pop().trim().split(/\s+/)[0];
      if (proseNodeId === nodeId) {
        decorations.push(
          Decoration.line({ class: "cm-highlight" }).range(line.from),
        );
      }
    } else {
      const definitionPart = trimmedLine.split(";")[0].trim();
      const parts = definitionPart.split(/\s+/);
      const potentialNodeId = stripPrefixes(parts[0]);
      if (potentialNodeId === nodeId) {
        decorations.push(
          Decoration.line({ class: "cm-highlight" }).range(line.from),
        );
      }
    }
  }

  const plugin = editor.plugin(highlightPlugin);
  if (plugin) {
    plugin.decorations = Decoration.set(decorations);
    editor.dispatch({
      // This is a dummy transaction to force the view to update
    });
  }
}

export function clearHighlightInEditor() {
  const editor = getEditorView();
  const plugin = editor.plugin(highlightPlugin);
  if (plugin && plugin.decorations.size > 0) {
    plugin.decorations = Decoration.none;
    editor.dispatch({
      // This is a dummy transaction to force the view to update
    });
  }
}

/**
 * Updates a node's position in the slide where it first appears.
 * @param {string} nodeId - The node identifier
 * @param {number} percentX - X position as percentage (0-100)
 * @param {number} percentY - Y position as percentage (0-100)
 * @param {number} slideIndex - The slide index where this node first appears
 */
export function updateNodePositionInEditor(
  nodeId,
  percentX,
  percentY,
  slideIndex,
) {
  const editor = getEditorView();
  const doc = editor.state.doc;
  const parsedData = currentParsedData;

  if (!parsedData || !parsedData.slides) return;

  // Find the slide's line range
  const rawSlides = parsedData.slides;
  if (!rawSlides || slideIndex >= rawSlides.length) return;

  const targetSlide = rawSlides[slideIndex];
  const startLine = targetSlide.lineStart;
  const endLine = targetSlide.lineEnd;

  // Search for the node reference in this slide
  let foundLine = null;
  let lineText = null;
  let hasPrefix = false;
  let prefix = "";

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = doc.line(lineNum);
    const trimmed = line.text.trim();

    // Check for various node reference patterns
    // Pattern 1: +NodeId or ~NodeId or NodeId
    const prefixMatch = trimmed.match(/^([+~]?)(\S+)$/);
    if (prefixMatch && prefixMatch[2] === nodeId) {
      foundLine = lineNum;
      lineText = line.text;
      hasPrefix = prefixMatch[1].length > 0;
      prefix = prefixMatch[1];
      break;
    }

    // Pattern 2: NodeId (x, y) - already has position
    const posMatch = trimmed.match(
      /^([+~]?)(\S+)\s*\(\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\)$/,
    );
    if (posMatch && posMatch[2] === nodeId) {
      foundLine = lineNum;
      lineText = line.text;
      hasPrefix = posMatch[1].length > 0;
      prefix = posMatch[1];
      break;
    }
  }

  if (foundLine === null) return;

  // Build the new line with position
  const leadingWhitespace = lineText.match(/^\s*/)[0];
  const newText = `${leadingWhitespace}${prefix}${nodeId} (${percentX}, ${percentY})`;

  // Apply the change
  const line = doc.line(foundLine);
  editor.dispatch({
    changes: {
      from: line.from,
      to: line.to,
      insert: newText,
    },
  });
}

/**
 * Updates or adds a @view directive for the specified slide
 * @param {number} slideIndex - The slide index to update
 * @param {number} centerX - Center X position as percentage (0-100)
 * @param {number} centerY - Center Y position as percentage (0-100)
 * @param {number} scale - Zoom scale (e.g., 0.8, 1.5)
 */
export function updateViewTransformInEditor(
  slideIndex,
  centerX,
  centerY,
  scale,
) {
  const editor = getEditorView();
  const doc = editor.state.doc;
  const parsedData = currentParsedData;

  if (!parsedData || !parsedData.slides) return;

  const rawSlides = parsedData.slides;
  if (!rawSlides || slideIndex >= rawSlides.length) return;

  const targetSlide = rawSlides[slideIndex];
  const startLine = targetSlide.lineStart;
  const endLine = targetSlide.lineEnd;

  // Search for existing @view directive in this slide
  let foundViewLine = null;
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = doc.line(lineNum);
    const trimmed = line.text.trim();
    if (trimmed.startsWith("@view")) {
      foundViewLine = lineNum;
      break;
    }
  }

  const viewText = `@view (${centerX.toFixed(1)}, ${centerY.toFixed(1)}, ${scale.toFixed(2)})`;

  if (foundViewLine !== null) {
    // Update existing @view directive
    const line = doc.line(foundViewLine);
    const leadingWhitespace = line.text.match(/^\s*/)[0];
    editor.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: `${leadingWhitespace}${viewText}`,
      },
    });
  } else {
    // Add new @view directive at the start of the slide
    const insertLine = doc.line(startLine);
    const leadingWhitespace = insertLine.text.match(/^\s*/)[0];
    editor.dispatch({
      changes: {
        from: insertLine.from,
        to: insertLine.from,
        insert: `${leadingWhitespace}${viewText}\n`,
      },
    });
  }
}
