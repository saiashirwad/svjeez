import type { Attachment } from "svelte/attachments";

export interface Point {
  readonly x: number;
  readonly y: number;
}

const localPoint = (svg: SVGSVGElement, e: PointerEvent): Point => {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());

  return { x: p.x, y: p.y };
};

/** Pointer drag on the element, reported in the instrument's own coordinates. */
export const drag =
  (handlers: {
    start?: (p: Point) => void;
    move: (p: Point, from: Point) => void;
    end?: () => void;
  }): Attachment<SVGElement> =>
  (target) => {
    // SAFETY: an element with no owner svg is the outer svg itself.
    const svg = target.ownerSVGElement ?? (target as SVGSVGElement);

    const down = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const from = localPoint(svg, event);
      target.setPointerCapture(event.pointerId);
      svg.classList.add("held");
      handlers.start?.(from);
      const move = (m: PointerEvent) => handlers.move(localPoint(svg, m), from);

      const up = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        svg.classList.remove("held");
        handlers.end?.();
      };

      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    };

    target.addEventListener("pointerdown", down);

    return () => target.removeEventListener("pointerdown", down);
  };

/** Calls `frame` with the time and the step since the last call (capped at 50 ms) on every animation frame. */
export const frames =
  (frame: (now: number, dt: number) => void): Attachment =>
  () => {
    let last = performance.now();

    let id = requestAnimationFrame(function tick(now) {
      frame(now, Math.min(now - last, 50));
      last = now;
      id = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(id);
  };
