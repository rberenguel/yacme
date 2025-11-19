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
              if (update.docChanged) {
                setSlideContext(cumulativeSlides, currentSlideIndex);
                updateDiagram(parsedData.nodes);
              } else if (update.selectionSet && currentSlideIndex !== null) {
                // Cursor moved, update slide preview
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

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmedLine = line.text.trim();

    if (trimmedLine.includes("->")) {
      const [sourcePart, targetPart] = trimmedLine
        .split("->")
        .map((s) => s.trim());
      const sourceId = sourcePart.split(/\s+/)[0];
      const targetId = targetPart.split(/\s+/)[0];
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
      const potentialNodeId = parts[0];
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
