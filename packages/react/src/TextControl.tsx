/** @jsxImportSource react */
/** @jsxRuntime automatic */
import type { Editor, ValueOf } from "@svjeez/live";
import { useEditorState } from "./editor.ts";
import { focusing } from "./selection.ts";

export function TextControl({ editor, value }: { editor: Editor; value: ValueOf<"text"> }) {
  const selected = useEditorState(editor, (s) => s.selected === value.key);

  return (
    <input
      className="sj-text"
      type="text"
      data-sj-key={value.key}
      data-selected={selected || undefined}
      aria-label={value.label || "text"}
      maxLength={value.maxLength}
      value={value.literal.value}
      onChange={(e) => editor.send({ type: "set", key: value.key, value: e.currentTarget.value })}
      {...focusing(editor, value.key)}
    />
  );
}
