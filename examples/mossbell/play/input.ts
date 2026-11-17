import type { Point } from "svjeez";

const AXES: readonly (readonly [code: string, x: number, y: number])[] = [
  ["KeyW", 0, -1],
  ["ArrowUp", 0, -1],
  ["KeyS", 0, 1],
  ["ArrowDown", 0, 1],
  ["KeyA", -1, 0],
  ["ArrowLeft", -1, 0],
  ["KeyD", 1, 0],
  ["ArrowRight", 1, 0],
];

export interface Input {
  /** The direction the held keys point, at most 1 long. */
  axis(): Point;
  /** True once for each press of a key, by `KeyboardEvent.code`. */
  took(code: string): boolean;
  /** Forget every key that is down, for when something else takes the keyboard. */
  release(): void;
}

/** Keys held and keys pressed, read once a frame. Typing in a field is left alone. */
export const createInput = (): Input => {
  const held = new Set<string>();
  const pressed = new Set<string>();

  const typing = (event: KeyboardEvent): boolean =>
    event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

  window.addEventListener("keydown", (event) => {
    if (typing(event) || event.metaKey || event.ctrlKey) return;

    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);

    if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
  });

  window.addEventListener("keyup", (event) => held.delete(event.code));
  window.addEventListener("blur", () => held.clear());

  return {
    axis() {
      let x = 0;
      let y = 0;

      for (const [code, dx, dy] of AXES)
        if (held.has(code)) {
          x += dx;
          y += dy;
        }

      const length = Math.max(1, Math.hypot(x, y));

      return { x: x / length, y: y / length };
    },
    took: (code) => pressed.delete(code),
    release() {
      held.clear();
      pressed.clear();
    },
  };
};
