import { bend, bezierOf, curveOf, type ValueOf } from "@svjeez/live";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { SceneEditor } from "./editor.ts";

// The unit square sits low in the box so a curve can overshoot above and below it.
const W = 200;
const H = 240;
const X = (u: number) => 20 + u * (W - 60);
const Y = (v: number) => 195 - v * 85;
const UX = (x: number) => (x - 20) / (W - 60);
const UY = (y: number) => (195 - y) / 85;
const MIN_Y = -0.8;
const MAX_Y = 2.2;

const ARROWS = new Map<string, readonly [number, number]>([
  ["ArrowLeft", [-1, 0]],
  ["ArrowRight", [1, 0]],
  ["ArrowUp", [0, 1]],
  ["ArrowDown", [0, -1]],
]);

export function EasePop({
  editor,
  value,
  anchor,
  onClose,
}: {
  editor: SceneEditor;
  value: ValueOf<"ease">;
  /** The glyph the popover opened from, which it sits under and returns focus to. */
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const p = bezierOf(value.literal.value);

  const d = curveOf(value.literal.value)
    .map((q, k) => `${k ? "L" : "M"}${X(q.x).toFixed(2)} ${Y(q.y).toFixed(2)}`)
    .join("");

  const pop = useRef<HTMLSpanElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const held = useRef<0 | 1 | null>(null);
  const going = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

  // The popover sits in the top layer, so the code panel's scrolling never clips it.
  useLayoutEffect(() => {
    const el = pop.current;

    if (!el) return;
    el.showPopover();
    const at = anchor.getBoundingClientRect();
    const room = window.innerHeight - at.bottom;
    const left = Math.max(8, Math.min(at.left, window.innerWidth - el.offsetWidth - 8));

    el.style.left = `${left}px`;
    el.style.top = `${room >= el.offsetHeight + 12 ? at.bottom + 6 : Math.max(8, at.top - el.offsetHeight - 6)}px`;
    el.querySelector<SVGElement>(".sj-handle")?.focus();
  }, [anchor]);

  useEffect(() => {
    const outside = (e: Event) => {
      const hit = e.target;

      if (!(hit instanceof Node) || pop.current?.contains(hit) || anchor.contains(hit)) return;

      // Unmounting a focused handle sends no blur, which would leave the ease selected; the pointer's own focus change
      // then blurs the glyph instead.
      if (pop.current?.contains(document.activeElement)) anchor.focus();
      close.current();
    };

    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      anchor.focus();
      close.current();
    };

    const scrolled = () => close.current();

    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", scrolled, true);

    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", scrolled, true);
    };
  }, [anchor]);

  const set = (which: 0 | 1, x: number, y: number) => {
    editor.send({
      type: "set",
      key: value.key,
      value: bend(value.literal.value, which, x, Math.min(MAX_Y, Math.max(MIN_Y, y))),
      continues: going.current,
    });
    going.current = true;
  };

  const grab = (e: PointerEvent, which: 0 | 1) => {
    e.preventDefault();
    svg.current?.setPointerCapture(e.pointerId);
    held.current = which;
    going.current = false;
  };

  const move = (e: PointerEvent) => {
    const which = held.current;
    const el = svg.current;

    if (which === null || !el) return;
    const box = el.getBoundingClientRect();

    set(
      which,
      UX(((e.clientX - box.left) / box.width) * W),
      UY(((e.clientY - box.top) / box.height) * H),
    );
  };

  const release = () => {
    held.current = null;
  };

  const key = (e: KeyboardEvent, which: 0 | 1) => {
    const by = ARROWS.get(e.key);

    if (!by) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.25 : 0.05;
    going.current = false;
    set(which, p[which * 2]! + by[0] * step, p[which * 2 + 1]! + by[1] * step);
  };

  return (
    <span ref={pop} className="sj-pop" popover="manual" role="dialog" aria-label="Ease curve">
      <svg
        ref={svg}
        className="sj-curve"
        viewBox={`0 0 ${W} ${H}`}
        role="presentation"
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <rect className="sj-box" x={X(0)} y={Y(1)} width={X(1) - X(0)} height={Y(0) - Y(1)} />
        <line className="sj-arm" x1={X(0)} y1={Y(0)} x2={X(p[0])} y2={Y(p[1])} />
        <line className="sj-arm" x1={X(1)} y1={Y(1)} x2={X(p[2])} y2={Y(p[3])} />
        <path className="sj-path" d={d} />
        {([0, 1] as const).map((which) => (
          <circle
            key={which}
            className="sj-handle"
            role="slider"
            tabIndex={0}
            data-which={which}
            aria-label={`${which ? "Second" : "First"} control point`}
            aria-valuemin={MIN_Y}
            aria-valuemax={MAX_Y}
            aria-valuenow={p[which * 2 + 1]}
            aria-valuetext={`x ${p[which * 2]}, y ${p[which * 2 + 1]}`}
            cx={X(p[which * 2]!)}
            cy={Y(p[which * 2 + 1]!)}
            r="7"
            onPointerDown={(e) => grab(e, which)}
            onKeyDown={(e) => key(e, which)}
          />
        ))}
      </svg>
      <code className="sj-pop-text">{value.literal.text}</code>
    </span>
  );
}
