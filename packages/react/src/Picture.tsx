import { valueOf } from "@svjeez/live";
import { Grip } from "./Grip.tsx";
import type { SceneEditor } from "./editor.ts";

export function Picture({ editor }: { editor: SceneEditor }) {
  const doc = editor.state;
  const { picture } = doc;

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
          {Object.entries(doc.grips).map(([key, grip]) => {
            const value = valueOf(doc, key);

            return value?.kind === "number" ? (
              <Grip key={key} editor={editor} value={value} grip={grip} scene={picture.scene} />
            ) : null;
          })}
        </>
      )}
    </figure>
  );
}
