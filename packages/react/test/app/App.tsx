import "@svjeez/live/editor.css";
import { Activity, memo as memoized, useState } from "react";
import { Code, Picture, Transport, useEditor } from "../../src/index.ts";
import handled from "./handles.tsx?raw";
import plain from "./scene.tsx?raw";

const Memo = memoized(Picture);

interface Props {
  scene: string | null;
  wrap?: boolean;
  /** Draws the picture through `memo`, which re-renders only when its props change. */
  memo?: boolean;
  /** Puts the editor under an `<Activity>` that a button hides and shows. */
  hideable?: boolean;
}

export function App(props: Props) {
  const [shown, setShown] = useState(true);

  if (!props.hideable) return <Editor {...props} />;

  return (
    <>
      <button type="button" onClick={() => setShown(!shown)}>
        {shown ? "Hide" : "Show"}
      </button>
      <Activity mode={shown ? "visible" : "hidden"}>
        <Editor {...props} />
      </Activity>
    </>
  );
}

function Editor({ scene, wrap, memo }: Props) {
  const editor = useEditor(scene === "handles" ? handled : plain);

  return (
    <main>
      {memo ? <Memo editor={editor} /> : <Picture editor={editor} />}
      <Transport editor={editor} />
      <Code
        editor={editor}
        file="scene.tsx"
        control={
          wrap
            ? (value, plain) => (
                <span className="wrapped" data-kind={value.kind}>
                  {plain}
                </span>
              )
            : undefined
        }
      />
      <button type="button" onClick={() => editor.send({ type: "undo" })}>
        Undo
      </button>
      <button
        type="button"
        onClick={() =>
          editor.send({
            type: "replace",
            text: `${editor.getState().text}\nexport const broken = ;`,
          })
        }
      >
        Break
      </button>
    </main>
  );
}
