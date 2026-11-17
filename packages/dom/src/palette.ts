import type { Base16, Slot } from "svjeez";
import { channels, isPair } from "./paint.ts";
import type { Paint } from "./tree.ts";

/** A base16 palette in both schemes, as `adaptive()` takes it: the colors a recorded page paints with. */
export interface Palette {
  readonly light: Base16;
  readonly dark: Base16;
}

// SAFETY: a Base16 has exactly these sixteen keys.
const slotsOf = (palette: Palette) => Object.keys(palette.light) as Slot[];

/** CSS for the recorded page: `--base00` to `--base0F` on `:root`, the dark values under the dark pass's media query. */
export const paletteCss = (palette: Palette): string => {
  const decl = (side: Base16) =>
    slotsOf(palette)
      .map((slot) => `--${slot}:${side[slot]}`)
      .join(";");

  return `:root{${decl(palette.light)}}@media (prefers-color-scheme:dark){:root{${decl(palette.dark)}}}`;
};

const hex = (color: string): readonly [number, number, number] | undefined => {
  const m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());

  if (!m) return undefined;

  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;

  // SAFETY: three offsets map to three channels.
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

/** A palette slot, and the alpha a recorded color takes it at. */
export interface Role {
  readonly slot: Slot;
  readonly alpha: number;
}

/**
 * Finds the slot a recorded color is, in both schemes at once, so a color two slots share in one scheme is told apart by
 * the other. A see-through color matches its slot at its alpha: Chromium reads colors through a canvas, whose
 * premultiplied pixels round the channels of a faint color by up to half a step over its alpha.
 */
export const roles = (palette: Palette) => {
  const slots = slotsOf(palette).flatMap((slot) => {
    const light = hex(palette.light[slot]);
    const dark = hex(palette.dark[slot]);

    return light && dark ? [{ slot, light, dark }] : [];
  });

  const found = new Map<string, Role | undefined>();

  return (color: Paint<string>): Role | undefined => {
    const light = isPair(color) ? color.light : color;
    const dark = isPair(color) ? color.dark : color;
    const key = `${light}|${dark}`;

    if (found.has(key)) return found.get(key);

    const [lr, lg, lb, la] = channels(light);
    const [dr, dg, db, da] = channels(dark);
    // A clear color only ends a fade and is never seen, so near its slot is enough.
    const slack = la === 0 ? 6 : 1 + 0.5 / la;
    let best: Role | undefined;
    let nearest = Infinity;

    if (/^rgba?\(/.test(light) && /^rgba?\(/.test(dark) && Math.abs(la - da) < 0.01)
      for (const s of slots) {
        const off = Math.max(
          Math.abs(lr - s.light[0]),
          Math.abs(lg - s.light[1]),
          Math.abs(lb - s.light[2]),
          Math.abs(dr - s.dark[0]),
          Math.abs(dg - s.dark[1]),
          Math.abs(db - s.dark[2]),
        );

        if (off <= slack && off < nearest) {
          nearest = off;
          best = { slot: s.slot, alpha: la };
        }
      }

    found.set(key, best);

    return best;
  };
};
