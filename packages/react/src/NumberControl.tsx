import { arrowNumber, scrubbing, type Editor, type ValueOf } from "@svjeez/live";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useEditorState } from "./editor.ts";
import { focusing } from "./selection.ts";

export function NumberControl({ editor, value }: { editor: Editor; value: ValueOf<"number"> }) {
  const selected = useEditorState(editor, (s) => s.selected === value.key);
  const drag = useRef<ReturnType<typeof scrubbing> | null>(null);
  const [dragging, setDragging] = useState(false);

  const down = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // No text selection starts under the pointer, which would end the drag.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = scrubbing(editor, value, e.clientX);
    setDragging(true);
  };

  const release = () => {
    drag.current = null;
    setDragging(false);
  };

  const key = (e: KeyboardEvent) => {
    if (arrowNumber(editor, value, e.key, e.shiftKey)) e.preventDefault();
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
      onPointerMove={(e) => drag.current?.(e.clientX, e.shiftKey)}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={key}
      {...focusing(editor, value.key)}
    >
      {value.literal.text}
    </span>
  );
}
