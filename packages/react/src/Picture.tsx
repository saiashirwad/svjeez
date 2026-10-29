import { valueOf, type Editor } from "@svjeez/live";
import { Grip } from "./Grip.tsx";
import { useEditorState } from "./editor.ts";

export function Picture({ editor }: { editor: Editor }) {
  const state = useEditorState(editor);
  const { picture } = state;

  return (
    <figure className="sj-picture">
      {picture && (
        <>
          <img
            className="sj-img"
            src={picture.url}
            alt={picture.scene.title}
            width={picture.scene.width || undefined}
            height={picture.scene.height || undefined}
          />
          {Object.entries(state.grips).map(([key, grip]) => {
            const value = valueOf(state, key);

            return value?.kind === "number" ? (
              <Grip key={key} editor={editor} value={value} grip={grip} scene={picture.scene} />
            ) : null;
          })}
        </>
      )}
    </figure>
  );
}
