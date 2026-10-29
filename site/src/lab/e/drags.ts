/**
 * Follows the pointer that went down until it lifts or is cancelled. The listeners sit on the window, so a target that
 * is replaced or hidden mid-drag cannot strand the drag.
 */
export const drag = (
  down: PointerEvent,
  h: { move?: (m: PointerEvent) => void; end?: (u: PointerEvent, cancelled: boolean) => void },
) => {
  try {
    if (down.currentTarget instanceof Element) down.currentTarget.setPointerCapture(down.pointerId);
  } catch {
    // The pointer may be gone already; the window listeners carry the drag either way.
  }

  const move = (m: PointerEvent) => {
    if (m.pointerId === down.pointerId) h.move?.(m);
  };

  const finish = (cancelled: boolean) => (u: PointerEvent) => {
    if (u.pointerId !== down.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    h.end?.(u, cancelled);
  };

  const up = finish(false);
  const cancel = finish(true);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
};

/** A point on the screen in client px, where a carried copy floats. */
export interface At {
  readonly x: number;
  readonly y: number;
}

export interface Carrying {
  /** How far the pointer moves before the copy lifts, in px. 0 lifts it at once. */
  readonly slop: number;
  /** Where the floating copy sits, from the moment it lifts; undefined once it is put down. */
  readonly float: (at: At | undefined) => void;
  readonly over: (m: PointerEvent, lifted: boolean) => void;
  /** The pointer lifted. `lifted` is whether the copy had come off. A cancel never reaches this. */
  readonly end: (u: PointerEvent, lifted: boolean) => void;
  /** Undoes whatever `over` showed, on lift and on cancel alike. */
  readonly clear: () => void;
}

/** A drag that carries a floating copy of what was grabbed once the pointer has moved `slop` px. */
export const carryDrag = (down: PointerEvent, o: Carrying) => {
  let lifted = !o.slop;

  if (lifted) o.float({ x: down.clientX, y: down.clientY });
  drag(down, {
    move(m) {
      if (!lifted && Math.hypot(m.clientX - down.clientX, m.clientY - down.clientY) > o.slop)
        lifted = true;

      if (lifted) o.float({ x: m.clientX, y: m.clientY });
      o.over(m, lifted);
    },
    end(u, cancelled) {
      o.float(undefined);
      o.clear();

      if (!cancelled) o.end(u, lifted);
    },
  });
};
