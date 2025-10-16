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
import { parseCompactFormat } from "./parser.js";
import { updateDiagram } from "./diagram.js";

let editorView;

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
          if (update.docChanged) {
            try {
              const newData = parseCompactFormat(update.state.doc.toString());
              updateDiagram(newData);
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
