import {
  arrowEase,
  BEND_Y,
  bending,
  bezierOf,
  curveOf,
  type Editor,
  type ValueOf,
} from "@svjeez/live";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

// The unit square sits low in the box so a curve can overshoot above and below it.
const W = 200;
const H = 240;
const X = (u: number) => 20 + u * (W - 60);
const Y = (v: number) => 195 - v * 85;
const UX = (x: number) => (x - 20) / (W - 60);
const UY = (y: number) => (195 - y) / 85;

export function EasePop({
  editor,
  value,
  anchor,
  onClose,
}: {
  editor: Editor;
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
  const drag = useRef<ReturnType<typeof bending> | null>(null);
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

  const grab = (e: PointerEvent, which: 0 | 1) => {
    e.preventDefault();
    svg.current?.setPointerCapture(e.pointerId);
    drag.current = bending(editor, value, which);
  };

  const move = (e: PointerEvent) => {
    const el = svg.current;

    if (!drag.current || !el) return;
    const box = el.getBoundingClientRect();

    drag.current({
      x: UX(((e.clientX - box.left) / box.width) * W),
      y: UY(((e.clientY - box.top) / box.height) * H),
    });
  };

  const release = () => {
    drag.current = null;
  };

  const key = (e: KeyboardEvent, which: 0 | 1) => {
    if (arrowEase(editor, value, which, e.key, e.shiftKey)) e.preventDefault();
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
            aria-valuemin={BEND_Y.min}
            aria-valuemax={BEND_Y.max}
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
