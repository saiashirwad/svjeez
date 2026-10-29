import { nudge, scrub, type ValueOf } from "@svjeez/live";
import type { NumberParam } from "svjeez/params";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { SceneEditor } from "./editor.ts";
import { ARROWS, selection } from "./selection.ts";

export function NumberControl({
  editor,
  value,
}: {
  editor: SceneEditor;
  value: ValueOf<"number">;
}) {
  const selected = editor.state.selected === value.key;
  const held = useRef<{ from: number; x: number; param: NumberParam } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Whether a step of this gesture is already in the history, so undo takes the drag whole. */
  const going = useRef(false);

  const set = (v: number) => {
    editor.send({ type: "set", key: value.key, value: v, continues: going.current });
    going.current = true;
  };

  const down = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // No text selection starts under the pointer, which would end the drag.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The range is read from the value, so a drag keeps the one it started with or every step would widen it.
    held.current = { from: value.literal.value, x: e.clientX, param: value.param };
    going.current = false;
    setDragging(true);
  };

  const move = (e: PointerEvent) => {
    if (held.current)
      set(scrub(held.current.param, held.current.from, e.clientX - held.current.x, e.shiftKey));
  };

  const release = () => {
    held.current = null;
    setDragging(false);
  };

  const key = (e: KeyboardEvent) => {
    const by = ARROWS.get(e.key);

    if (!by) return;
    e.preventDefault();
    going.current = false;
    set(nudge(value.param, value.literal.value, by, e.shiftKey));
  };

  return (
    <span
      className="sj-num"
      role="slider"
      tabIndex={0}
      data-sj-key={value.key}
      data-selected={selected || undefined}
      data-dragging={dragging ? "" : undefined}
      aria-label={value.label || "number"}
      aria-valuemin={value.param.min}
      aria-valuemax={value.param.max}
      aria-valuenow={value.literal.value}
      aria-valuetext={`${value.literal.value}${value.param.unit ?? ""}`}
      title={`${value.label ? `${value.label}: ` : ""}drag sideways`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={key}
      {...selection(editor, value.key)}
    >
      {value.literal.text}
    </span>
  );
}
