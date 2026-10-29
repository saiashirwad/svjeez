import {
  arrowNumber,
  following,
  handleAt,
  type Editor,
  type Grip as GripOf,
  type SceneSize,
  type ValueOf,
} from "@svjeez/live";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useEditorState } from "./editor.ts";
import { focusing } from "./selection.ts";

export function Grip({
  editor,
  value,
  grip,
  scene,
}: {
  editor: Editor;
  value: ValueOf<"number">;
  grip: GripOf;
  scene: SceneSize;
}) {
  const selected = useEditorState(editor, (s) => s.selected === value.key);
  const at = handleAt(grip, value.literal.value);
  const drag = useRef<ReturnType<typeof following> | null>(null);

  const down = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // No text selection or native drag starts under the pointer, which would cancel this one.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The picture keeps its size for the drag, so measure it once rather than on every move.
    const picture = e.currentTarget.parentElement;
    const scale = picture ? scene.width / picture.clientWidth : 1;
    drag.current = following(editor, value, grip, { x: e.clientX, y: e.clientY }, scale);
  };

  const release = () => {
    drag.current = null;
  };

  const key = (e: KeyboardEvent) => {
    if (arrowNumber(editor, value, e.key, e.shiftKey)) e.preventDefault();
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
      onPointerMove={(e) => drag.current?.({ x: e.clientX, y: e.clientY })}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={key}
      {...focusing(editor, value.key)}
    />
  );
}
