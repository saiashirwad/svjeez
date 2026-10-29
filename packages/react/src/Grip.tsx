import { handleAt, nudge, type Grip as GripOf, type SceneSize, type ValueOf } from "@svjeez/live";
import { fit, follow } from "svjeez/params";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { SceneEditor } from "./editor.ts";
import { ARROWS, selection } from "./selection.ts";

export function Grip({
  editor,
  value,
  grip,
  scene,
}: {
  editor: SceneEditor;
  value: ValueOf<"number">;
  grip: GripOf;
  scene: SceneSize;
}) {
  const selected = editor.state.selected === value.key;
  const at = handleAt(grip, value.literal.value);

  /** A drag carries the value as far as it carries the handle, along the way the handle travels. */
  const held = useRef<{ raw: number; scale: number; x: number; y: number } | null>(null);
  const going = useRef(false);

  const set = (v: number) => {
    editor.send({ type: "set", key: value.key, value: v, continues: going.current });
    going.current = true;
  };

  const down = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // No text selection or native drag starts under the pointer, which would cancel this one.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The picture keeps its size for the drag, so measure it once rather than on every move.
    const picture = e.currentTarget.parentElement;
    held.current = {
      raw: value.literal.value,
      scale: picture ? scene.width / picture.clientWidth : 1,
      x: e.clientX,
      y: e.clientY,
    };
    going.current = false;
  };

  const move = (e: PointerEvent) => {
    const h = held.current;

    if (!h) return;
    const by = { x: (e.clientX - h.x) * h.scale, y: (e.clientY - h.y) * h.scale };
    h.x = e.clientX;
    h.y = e.clientY;
    h.raw = follow(value.param, (v) => handleAt(grip, v), h.raw, by);
    set(fit(value.param, h.raw));
  };

  const release = () => {
    held.current = null;
  };

  const key = (e: KeyboardEvent) => {
    const by = ARROWS.get(e.key);

    if (!by) return;
    e.preventDefault();
    going.current = false;
    set(nudge(value.param, value.literal.value, by, e.shiftKey));
  };

  return (
    <div
      className="sj-grip"
      role="slider"
      tabIndex={0}
      data-sj-key={value.key}
      data-selected={selected || undefined}
      data-text={`${value.label || value.key} ${value.literal.text}${value.param.unit ?? ""}`}
      aria-label={value.label || value.key}
      aria-valuemin={value.param.min}
      aria-valuemax={value.param.max}
      aria-valuenow={value.literal.value}
      style={{ left: `${(at.x / scene.width) * 100}%`, top: `${(at.y / scene.height) * 100}%` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={key}
      {...selection(editor, value.key)}
    />
  );
}
