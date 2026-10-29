import { curveOf, type ValueOf } from "@svjeez/live";
import { useState } from "react";
import { EasePop } from "./EasePop.tsx";
import type { SceneEditor } from "./editor.ts";
import { selection } from "./selection.ts";

export function EaseControl({ editor, value }: { editor: SceneEditor; value: ValueOf<"ease"> }) {
  const selected = editor.state.selected === value.key;
  const [open, setOpen] = useState(false);
  const [glyph, setGlyph] = useState<HTMLButtonElement | null>(null);

  const d = curveOf(value.literal.value)
    .map((p, k) => `${k ? "L" : "M"}${(p.x * 24).toFixed(2)} ${(18 - p.y * 18).toFixed(2)}`)
    .join("");

  return (
    <span
      className="sj-ease"
      data-sj-key={value.key}
      data-selected={selected || undefined}
      {...selection(editor, value.key)}
    >
      <button
        ref={setGlyph}
        className="sj-glyph"
        type="button"
        aria-label={`Bend ${value.label || "ease"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="-2 -8 28 28" aria-hidden="true">
          <rect className="sj-box" x="0" y="0" width="24" height="18" rx="2" />
          <path className="sj-path" d={d} />
        </svg>
      </button>
      <span className="sj-ease-text">{value.literal.text}</span>
      {open && glyph && (
        <EasePop editor={editor} value={value} anchor={glyph} onClose={() => setOpen(false)} />
      )}
    </span>
  );
}
