import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { KINDS } from "@svjeez/live/source";

// Colors come from custom properties in playground.css, so one theme serves light and dark.
const chrome = EditorView.theme({
  "&": {
    color: "var(--pg-ink)",
    backgroundColor: "transparent",
    fontSize: "0.75rem",
    blockSize: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--pg-mono)",
    fontVariantLigatures: "none",
    lineHeight: "1.65",
    overflow: "auto",
  },
  ".cm-content": { caretColor: "var(--pg-accent)", paddingBlock: "1rem" },
  ".cm-line": { paddingInline: "0.75rem 1rem" },
  ".cm-cursor": { borderLeftColor: "var(--pg-accent)", borderLeftWidth: "2px" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--pg-faint)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { paddingInline: "0.75rem 0.25rem", minInlineSize: "2.5ch" },
  // The current line shows only while the editor has focus, so a page that just loaded shows plain code.
  "&.cm-focused .cm-activeLine": { backgroundColor: "var(--pg-hover)" },
  "&.cm-focused .cm-activeLineGutter": {
    backgroundColor: "var(--pg-hover)",
    color: "var(--pg-muted)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--pg-select)" },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: "var(--pg-select)", outline: "none" },
});

// The same highlight classes the labs' code panels read from @svjeez/live, each with its playground color.
const color = (kind: keyof typeof KINDS, value: string, style: { fontStyle?: "italic" } = {}) => ({
  tag: [...KINDS[kind]],
  color: value,
  ...style,
});

const highlight = HighlightStyle.define([
  color("keyword", "var(--pg-kw)"),
  color("string", "var(--pg-str)"),
  color("number", "var(--pg-num)"),
  color("comment", "var(--pg-faint)", { fontStyle: "italic" }),
  color("fn", "var(--pg-fn)"),
  color("definition", "var(--pg-fn)"),
  color("tag", "var(--pg-tag)"),
  color("attr", "var(--pg-attr)"),
  color("punct", "var(--pg-muted)"),
]);

export const editorExtensions = (onChange: () => void): Extension[] => [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  drawSelection(),
  history(),
  indentOnInput(),
  bracketMatching(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  javascript({ jsx: true, typescript: true }),
  syntaxHighlighting(highlight),
  chrome,
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({
    "aria-label": "Scene source, TSX",
    spellcheck: "false",
    autocapitalize: "off",
  }),
  EditorView.updateListener.of((update) => update.docChanged && onChange()),
];

export const editorState = (doc: string, onChange: () => void) =>
  EditorState.create({ doc, extensions: editorExtensions(onChange) });

export { EditorView };
