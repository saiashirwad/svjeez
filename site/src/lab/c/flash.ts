import type { Attachment } from "svelte/attachments";

const shown = new WeakMap<Element, string>();

/** Flashes the element's background whenever `value` changes, not when it first appears unless `onFirst`. */
export const flashOnChange =
  (value: string, onFirst = false): Attachment<HTMLElement> =>
  (el) => {
    const before = shown.get(el);
    shown.set(el, value);

    if (before === value || (before === undefined && !onFirst)) return;

    el.animate(
      [
        {
          offset: 0,
          background: "color-mix(in oklch, var(--accent) 45%, transparent)",
          color: "var(--ink)",
        },
      ],
      { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  };
