import type { ValueOf } from "@svjeez/live";
import type { SceneEditor } from "./editor.ts";
import { selection } from "./selection.ts";

export function ChoiceControl({
  editor,
  value,
}: {
  editor: SceneEditor;
  value: ValueOf<"choice">;
}) {
  const selected = editor.state.selected === value.key;

  return (
    <select
      className="sj-choice"
      data-sj-key={value.key}
      data-selected={selected || undefined}
      aria-label={value.label || "choice"}
      value={value.literal.value}
      onChange={(e) => editor.send({ type: "set", key: value.key, value: e.currentTarget.value })}
      {...selection(editor, value.key)}
    >
      {value.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
