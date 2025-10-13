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
} from "CodeMirrorBundle";
import { parseCompactFormat } from "./parser.js";
import { updateDiagram } from "./diagram.js";

let editorView;

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
