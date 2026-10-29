import { rgbOf, stroke, withRgb, type Editor, type ValueOf } from "@svjeez/live";
import { useEffect, useRef } from "react";
import { useEditorState } from "./editor.ts";
import { focusing } from "./selection.ts";

export function ColorControl({ editor, value }: { editor: Editor; value: ValueOf<"color"> }) {
  const selected = useEditorState(editor, (s) => s.selected === value.key);
  const input = useRef<HTMLInputElement>(null);
  /** The pick under way, so undo takes it whole. */
  const pick = useRef<ReturnType<typeof stroke<"color">> | null>(null);

  // React's onChange is the native input event, so the end of a pick is only seen on the native change event.
  useEffect(() => {
    const el = input.current;

    const done = () => {
      pick.current = null;
    };

    el?.addEventListener("change", done);

    return () => el?.removeEventListener("change", done);
  }, []);

  return (
    <span
      className="sj-color"
      data-sj-key={value.key}
      data-selected={selected || undefined}
      {...focusing(editor, value.key)}
    >
      <input
        ref={input}
        className="sj-swatch"
        type="color"
        aria-label={`${value.label || "color"}, ${value.literal.value}`}
        value={rgbOf(value.literal.value)}
        onChange={(e) =>
          (pick.current ??= stroke<"color">(editor, value.key))(
            withRgb(value.literal.value, e.currentTarget.value),
          )
        }
      />
      <span className="sj-string">{value.literal.text}</span>
    </span>
  );
}
