import type { Editor, Value } from "@svjeez/live";
import { Fragment, type KeyboardEvent, type ReactNode } from "react";
import { Control } from "./Control.tsx";
import { useEditorState } from "./editor.ts";

export function Code({
  editor,
  file,
  control,
}: {
  editor: Editor;
  /** A file name for the header. */
  file?: string;
  /** Draws a value's control in place of the built-in one. Render `plain` to keep the built-in one. */
  control?: (value: Value, plain: ReactNode) => ReactNode;
}) {
  const state = useEditorState(editor);
  const values = new Map(state.values.map((v) => [v.key, v]));
  const { error } = state;

  const history = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
    e.preventDefault();
    editor.send({ type: e.shiftKey ? "redo" : "undo" });
  };

  return (
    <section className="sj-code" aria-label="Scene source" onKeyDown={history}>
      {file && <header className="sj-file">{file}</header>}
      <pre className="sj-source">
        <code>
          {state.lines.map((line) => (
            <span key={line.n} className="sj-line">
              {line.pieces.map((piece) => {
                if (piece.kind !== "literal")
                  return (
                    <span key={piece.start} className={`sj-${piece.kind}`}>
                      {piece.text}
                    </span>
                  );

                const value = values.get(piece.literal.key);

                if (!value) return null;
                const plain = <Control editor={editor} value={value} />;

                return (
                  <Fragment key={piece.literal.key}>
                    {control ? control(value, plain) : plain}
                  </Fragment>
                );
              })}
            </span>
          ))}
        </code>
      </pre>
      <p className="sj-error" role="status" hidden={!error}>
        {error ? `${error.line ? `Line ${error.line}: ` : ""}${error.message}` : null}
      </p>
    </section>
  );
}
