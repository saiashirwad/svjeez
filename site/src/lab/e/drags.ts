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

/** A floating copy of a part that follows the pointer while it's carried. */
const carry = (html: string, e: PointerEvent) => {
  const ghost = document.createElement("div");
  ghost.className = "le-ghost";
  ghost.innerHTML = html;
  document.body.append(ghost);

  const place = (m: PointerEvent) =>
    ghost.style.setProperty("translate", `${m.clientX}px ${m.clientY}px`);

  place(e);

  return { place, drop: () => ghost.remove() };
};

interface Carrying {
  readonly html: string;
  /** How far the pointer moves before the copy lifts, in px. 0 lifts it at once. */
  readonly slop: number;
  readonly over: (m: PointerEvent, lifted: boolean) => void;
  /** The pointer lifted. `lifted` is whether the copy had come off. A cancel never reaches this. */
  readonly end: (u: PointerEvent, lifted: boolean) => void;
  /** Undoes whatever `over` showed, on lift and on cancel alike. */
  readonly clear: () => void;
}

/** A drag that carries a floating copy of `html`. */
export const carryDrag = (down: PointerEvent, o: Carrying) => {
  let held: ReturnType<typeof carry> | undefined;

  const lift = (at: PointerEvent) => {
    held = carry(o.html, at);
    document.body.classList.add("le-carrying");
  };

  if (!o.slop) lift(down);
  drag(down, {
    move(m) {
      if (!held && Math.hypot(m.clientX - down.clientX, m.clientY - down.clientY) > o.slop) lift(m);
      held?.place(m);
      o.over(m, !!held);
    },
    end(u, cancelled) {
      held?.drop();
      document.body.classList.remove("le-carrying");
      o.clear();

      if (!cancelled) o.end(u, !!held);
    },
  });
};
