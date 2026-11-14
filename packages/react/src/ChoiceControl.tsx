import type { Editor, ValueOf } from "@svjeez/live";
import { useEditorState } from "./editor.ts";
import { focusing } from "./selection.ts";

export function ChoiceControl({ editor, value }: { editor: Editor; value: ValueOf<"choice"> }) {
  const selected = useEditorState(editor, (s) => s.selected === value.key);

  return (
    <select
      className="sj-choice"
      data-sj-key={value.key}
      data-selected={selected || undefined}
      aria-label={value.label || "choice"}
      value={value.literal.value}
      onChange={(e) => editor.send({ type: "set", key: value.key, value: e.currentTarget.value })}
      {...focusing(editor, value.key)}
    >
      {value.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
