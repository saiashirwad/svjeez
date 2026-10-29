import { rgbOf, withRgb, type ValueOf } from "@svjeez/live";
import { useEffect, useRef } from "react";
import type { SceneEditor } from "./editor.ts";
import { selection } from "./selection.ts";

export function ColorControl({ editor, value }: { editor: SceneEditor; value: ValueOf<"color"> }) {
  const selected = editor.state.selected === value.key;
  const input = useRef<HTMLInputElement>(null);
  /** Whether the picker has sent a step already, so undo takes one pick whole. */
  const going = useRef(false);

  // React's onChange is the native input event, so the end of a pick is only seen on the native change event.
  useEffect(() => {
    const el = input.current;

    const done = () => {
      going.current = false;
    };

    el?.addEventListener("change", done);

    return () => el?.removeEventListener("change", done);
  }, []);

  return (
    <span
      className="sj-color"
      data-sj-key={value.key}
      data-selected={selected || undefined}
      {...selection(editor, value.key)}
    >
      <input
        ref={input}
        className="sj-swatch"
        type="color"
        aria-label={`${value.label || "color"}, ${value.literal.value}`}
        value={rgbOf(value.literal.value)}
        onChange={(e) => {
          editor.send({
            type: "set",
            key: value.key,
            value: withRgb(value.literal.value, e.currentTarget.value),
            continues: going.current,
          });
          going.current = true;
        }}
      />
      <span className="sj-string">{value.literal.text}</span>
    </span>
  );
}
