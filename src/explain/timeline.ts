import { motion, type Motion, type Span } from "../motion";

export type Timeline<K extends string> = { readonly [P in K]: Span } & {
  readonly duration: number;
  show(name: K): Motion<"opacity">;
  from(name: K): Motion<"opacity">;
};

/** Consecutive named spans, separated by an optional gap. */
export function timeline<const T extends Record<string, number>>(durations: T, options: { readonly gap?: number; readonly fade?: number } = {}): Timeline<keyof T & string> {
  const gap = options.gap ?? 0;
  const fade = options.fade ?? 0.3;
  if (!Number.isFinite(gap) || gap < 0 || !Number.isFinite(fade) || fade <= 0) throw new Error("timeline() needs a non-negative gap and a positive fade.");
  const spans: Record<string, Span> = {};
  let end = 0;
  for (const [name, over] of Object.entries(durations)) {
    if (["duration", "show", "from"].includes(name)) throw new Error(`Reserved timeline name: ${name}.`);
    if (!Number.isFinite(over) || over <= 0) throw new Error(`timeline() needs a positive duration for ${name}.`);
    if (Object.keys(spans).length) end += gap;
    spans[name] = { at: end, over };
    end += over;
  }
  const get = (name: string): Span => {
    const found = spans[name];
    if (!found) throw new Error(`Unknown timeline span: ${name}.`);
    return found;
  };
  return {
    ...spans,
    duration: end,
    show(name: string) {
      const { at, over } = get(name);
      const f = Math.min(fade, over / 2);
      return motion({ opacity: 0 }).at(at).to({ opacity: 1 }, f).at(at + over - f).to({ opacity: 0 }, f);
    },
    from(name: string) {
      const { at, over } = get(name);
      return motion({ opacity: 0 }).at(at).to({ opacity: 1 }, Math.min(fade, over));
    },
  } as Timeline<keyof T & string>;
}
