import type { Value } from "@svjeez/live";
import type { KeyboardEvent, ReactNode } from "react";
import { Control } from "./Control.tsx";
import type { SceneEditor } from "./editor.ts";

export function Code({
  editor,
  file,
  control,
}: {
  editor: SceneEditor;
  /** A file name for the header. */
  file?: string;
  /** Draws a value's control in place of the built-in one. Render `plain` to keep the built-in one. */
  control?: (value: Value, plain: ReactNode) => ReactNode;
}) {
  const doc = editor.state;
  const values = new Map(doc.values.map((v) => [v.key, v]));
  const { error } = doc;

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
          {doc.lines.map((line) => (
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
                  <Slot key={piece.literal.key}>{control ? control(value, plain) : plain}</Slot>
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

function Slot({ children }: { children: ReactNode }) {
  return children;
}
