import { motion, type Motion, type Seconds, type Span } from "../motion";

export type Timeline<K extends string> = { readonly [P in K]: Span } & {
  readonly duration: Seconds;
  show(name: K): Motion<"opacity">;
  from(name: K): Motion<"opacity">;
};

export interface TimelineOptions {
  /** Seconds between scenes. Not scaled by `pace`. */
  readonly gap?: Seconds;
  readonly fade?: Seconds;
  /** Multiplies every scene length. */
  readonly pace?: number;
}

/** Fade in at the span's start, hold, fade out by its end. */
export const during = ({ at, over }: Span, fade: Seconds = 0.3): Motion<"opacity"> => {
  const f = Math.min(fade, over / 2);
  return motion({ opacity: 0 }).at(at).to({ opacity: 1 }, f).at(at + over - f).to({ opacity: 0 }, f);
};

/** Seconds a viewer needs to read `text`: words / wps + settle, at least `min`. */
export const read = (text: string | readonly string[], { wps = 3.5, min = 2, settle = 1 } = {}): Seconds =>
  Math.max(min, [text].flat().join(" ").split(/\s+/).filter(Boolean).length / wps + settle);

/** Consecutive named scenes, `gap` apart. */
export function timeline<const T extends Record<string, Seconds>>(durations: T, options: TimelineOptions = {}): Timeline<keyof T & string> {
  const { gap = 0, fade = 0.3, pace = 1 } = options;
  if (!(gap >= 0 && fade > 0 && pace > 0)) throw new Error("timeline() needs a non-negative gap, a positive fade and a positive pace.");
  const spans: Record<string, Span> = {};
  let end = 0;
  for (const [name, length] of Object.entries(durations)) {
    if (name === "duration" || name === "show" || name === "from") throw new Error(`"${name}" is reserved in a timeline.`);
    if (!(length > 0)) throw new Error(`Scene ${name} needs a positive length, got ${length}.`);
    const at = end === 0 ? 0 : end + gap;
    spans[name] = { at, over: length * pace };
    end = at + length * pace;
  }
  const span = (name: string): Span => {
    const found = spans[name];
    if (!found) throw new Error(`No scene named ${name}.`);
    return found;
  };
  return {
    ...spans,
    duration: end,
    show: (name: string) => during(span(name), fade),
    from: (name: string) => motion({ opacity: 0 }).at(span(name).at).to({ opacity: 1 }, Math.min(fade, span(name).over)),
  } as Timeline<keyof T & string>;
}
