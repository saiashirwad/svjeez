import "@svjeez/live/editor.css";
import { Code, Picture, Transport, useEditor } from "../../src/index.ts";
import handled from "./handles.tsx?raw";
import plain from "./scene.tsx?raw";

export function App({ scene, wrap }: { scene: string | null; wrap?: boolean }) {
  const editor = useEditor(scene === "handles" ? handled : plain);

  return (
    <main>
      <Picture editor={editor} />
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
          editor.send({ type: "replace", text: `${editor.state.text}\nexport const broken = ;` })
        }
      >
        Break
      </button>
    </main>
  );
}
