import { declarations, kebab, length, num, pct } from "./format";
import type { AnimationOptions, AnimationRequest, Frame, MotionProps } from "./types";

export const EASE = {
  out: "cubic-bezier(.23,1,.32,1)",
  inOut: "cubic-bezier(.77,0,.175,1)",
  linear: "linear",
  steps: (count: number): string => `steps(${Math.max(1, Math.round(count))}, end)`,
} as const;

export const frame = (t: number, props: MotionProps, ease?: string): Frame => ({ t, props, ease });

/** Declarative animation request; the Scene turns it into a class and keyframes. */
export const anim = (
  name: string,
  frames: Frame[],
  options?: AnimationOptions,
): AnimationRequest => ({ name, frames, ...(options ? { options } : {}) });

export interface RevealOptions {
  /** Enter window in seconds. Omit to start visible. */
  in?: [number, number];
  /** Exit window in seconds. Omit to remain visible. */
  out?: [number, number];
  from?: MotionProps;
  to?: MotionProps;
  exit?: MotionProps;
  ease?: string;
}

const cloneProps = (props: MotionProps): MotionProps => ({ ...props });

const sameProps = (a: MotionProps, b: MotionProps): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const dedupeFrames = (frames: Frame[]): Frame[] => {
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  const out: Frame[] = [];
  for (const current of sorted) {
    const previous = out[out.length - 1];
    if (previous && Math.abs(previous.t - current.t) < 1e-9) {
      if (!sameProps(previous.props, current.props)) {
        throw new Error(`Two frames share t=${current.t} with different properties.`);
      }
      if (current.ease) previous.ease = current.ease;
      else if (previous.ease) current.ease = previous.ease;
      continue;
    }
    out.push({ ...current, props: cloneProps(current.props) });
  }
  return out;
};

/** Fade in, hold, and optionally fade out — the most common film primitive. */
export const revealWindow = (options: RevealOptions): Frame[] => {
  const from = options.from ?? { opacity: 0 };
  const to = options.to ?? { opacity: 1 };
  const exit = options.exit ?? { opacity: 0 };
  const ease = options.ease ?? EASE.out;
  const frames: Frame[] = [];

  if (options.in) {
    const [start, end] = options.in;
    if (end <= start) throw new Error(`Enter window must end after it starts (${start}, ${end}).`);
    frames.push(frame(0, from));
    frames.push(frame(start, from));
    frames.push(frame(end, to, ease));
  } else {
    frames.push(frame(0, to));
  }

  if (options.out) {
    const [start, end] = options.out;
    if (end <= start) throw new Error(`Exit window must end after it starts (${start}, ${end}).`);
    const lastIn = options.in?.[1] ?? 0;
    if (start < lastIn) throw new Error(`Exit window starts before the enter window ends (${start} < ${lastIn}).`);
    frames.push(frame(start, to));
    frames.push(frame(end, exit, ease));
  }

  return dedupeFrames(frames);
};

export interface TypewriterOptions {
  start: number;
  end: number;
  distance: number;
  steps: number;
}

/** Slides a cover rect to the right in discrete steps. */
export const typewriter = (options: TypewriterOptions): Frame[] => {
  const { start, end, distance, steps } = options;
  if (end <= start) throw new Error("Typewriter end must be after start.");
  if (!Number.isFinite(distance)) throw new Error("Typewriter distance must be finite.");
  const ease = EASE.steps(steps);
  if (start <= 0) return dedupeFrames([frame(0, { x: 0 }, ease), frame(end, { x: distance })]);
  return dedupeFrames([
    frame(0, { x: 0 }),
    frame(start, { x: 0 }, ease),
    frame(end, { x: distance }),
  ]);
};

export interface DrawOptions {
  in: [number, number];
  out?: [number, number];
  opacity?: number;
}

/** For paths with pathLength="1" and stroke-dasharray="1". */
export const drawWindow = (options: DrawOptions): Frame[] => {
  const [start, end] = options.in;
  if (end <= start) throw new Error("Draw window must end after it starts.");
  const shown = options.opacity ?? 1;
  const frames: Frame[] = [
    frame(0, { opacity: 0, dashoffset: 1 }),
    frame(start, { opacity: 0, dashoffset: 1 }),
    frame(end, { opacity: shown, dashoffset: 0 }, EASE.out),
  ];
  if (options.out) {
    const [outStart, outEnd] = options.out;
    if (outStart < end) throw new Error("Draw exit starts before the draw finishes.");
    frames.push(frame(outStart, { opacity: shown, dashoffset: 0 }));
    frames.push(frame(outEnd, { opacity: 0, dashoffset: 0 }, EASE.out));
  }
  return dedupeFrames(frames);
};

/** Short, independently looping animations used for cursors and thinking dots. */
export const AMBIENT_CSS = `
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.blink{animation:blink 1.1s steps(1,end) infinite}
@keyframes pulse{0%,70%,100%{opacity:.22}35%{opacity:1}}
.pulse{animation:pulse 1.45s ease-in-out infinite}
`;

const transforms = (props: MotionProps): string | undefined => {
  if (props.transform !== undefined) return String(props.transform);
  const parts: string[] = [];
  if (props.x !== undefined || props.y !== undefined) {
    if (props.x !== undefined && props.y !== undefined) {
      parts.push(`translate(${length(props.x)},${length(props.y)})`);
    } else if (props.x !== undefined) {
      parts.push(`translateX(${length(props.x)})`);
    } else {
      parts.push(`translateY(${length(props.y as number)})`);
    }
  }
  if (props.rotate !== undefined) {
    const value = typeof props.rotate === "number" ? num(props.rotate) : String(props.rotate);
    parts.push(`rotate(${value.endsWith("deg") ? value : `${value}deg`})`);
  }
  if (props.scale !== undefined) {
    parts.push(`scale(${typeof props.scale === "number" ? num(props.scale) : props.scale})`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
};

/** Converts high-level motion props into ordered CSS declarations. */
export const motionDeclarations = (props: MotionProps): Array<[string, string]> => {
  const out = new Map<string, string>();
  if (props.opacity !== undefined) out.set("opacity", String(props.opacity));
  const transform = transforms(props);
  if (transform) out.set("transform", transform);
  if (props.dashoffset !== undefined) out.set("stroke-dashoffset", String(props.dashoffset));
  for (const [property, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (["opacity", "transform", "dashoffset", "x", "y", "scale", "rotate"].includes(property)) continue;
    out.set(kebab(property), String(value));
  }
  return [...out.entries()];
};

const slug = (name: string): string => {
  let value = name
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!value) value = "motion";
  if (!/^[a-zA-Z_]/.test(value)) value = `m-${value}`;
  return value;
};

export interface NormalizedAnimation {
  name: string;
  frames: Frame[];
  options: AnimationOptions;
}

/** Adds a frame at 0 and at the end so CSS fill-mode:both is deterministic. */
export const normalizeFrames = (frames: Frame[], duration: number, label = "animation"): Frame[] => {
  if (frames.length === 0) throw new Error(`Animation "${label}" needs at least one frame.`);
  if (!(duration > 0)) throw new Error("Animation duration must be positive.");
  const sorted = [...frames]
    .map((entry) => ({ ...entry, props: cloneProps(entry.props) }))
    .sort((a, b) => a.t - b.t);
  for (const entry of sorted) {
    if (!Number.isFinite(entry.t) || entry.t < 0 || entry.t > duration) {
      throw new Error(`Animation "${label}" has a frame outside 0..${duration}s: ${entry.t}`);
    }
    if (motionDeclarations(entry.props).length === 0) {
      throw new Error(`Animation "${label}" has an empty frame at ${entry.t}s.`);
    }
  }
  const first = sorted[0]!;
  if (first.t > 0) sorted.unshift({ ...first, t: 0, props: cloneProps(first.props), ease: undefined });
  const last = sorted[sorted.length - 1]!;
  if (last.t < duration) sorted.push({ ...last, t: duration, props: cloneProps(last.props), ease: undefined });
  const unique = dedupeFrames(sorted);
  const seen = new Set<string>();
  for (const entry of unique) {
    const key = pct((entry.t / duration) * 100);
    if (seen.has(key)) {
      throw new Error(`Animation "${label}" has frames that round to the same keyframe at ${key}.`);
    }
    seen.add(key);
  }
  if (unique.length < 2) throw new Error(`Animation "${label}" needs at least two distinct times.`);
  return unique;
};

export class Animator {
  readonly duration: number;
  private readonly baseTiming: string;
  private readonly specs = new Map<
    string,
    { signature: string; block: string; options: AnimationOptions }
  >();
  private readonly aliases = new Map<string, string>();

  constructor(duration: number, baseTiming: string = EASE.out) {
    if (!(duration > 0)) throw new Error("Animator duration must be positive.");
    this.duration = duration;
    this.baseTiming = baseTiming;
  }

  add(request: AnimationRequest): string {
    if (!request.name.trim()) throw new Error("Animation names cannot be empty.");
    const name = slug(request.name);
    const alias = this.aliases.get(name);
    if (alias && alias !== request.name) {
      throw new Error(`Animation names "${alias}" and "${request.name}" sanitize to the same id "${name}".`);
    }
    this.aliases.set(name, request.name);

    const frames = normalizeFrames(request.frames, this.duration, request.name);
    const options = request.options ?? {};
    const signature = JSON.stringify({ frames, options });
    const existing = this.specs.get(name);
    if (existing) {
      if (existing.signature !== signature) {
        throw new Error(`Animation "${request.name}" was registered twice with different frames.`);
      }
      return this.className(name);
    }

    const block = this.renderKeyframes(name, frames);
    this.specs.set(name, { signature, block, options });
    return this.className(name);
  }

  private className(name: string): string {
    return `a a-${name}`;
  }

  private renderKeyframes(name: string, frames: Frame[]): string {
    const lines = frames.map((entry) => {
      const decls = declarations(motionDeclarations(entry.props));
      const ease = entry.ease ? `;animation-timing-function:${entry.ease}` : "";
      return `${pct((entry.t / this.duration) * 100)}{${decls}${ease}}`;
    });
    return `@keyframes ${name}{\n${lines.join("\n")}\n}`;
  }

  private renderClass(name: string, options: AnimationOptions): string {
    const props = [`animation-name:${name}`];
    if (options.timing) props.push(`animation-timing-function:${options.timing}`);
    if (options.iterations !== undefined) props.push(`animation-iteration-count:${options.iterations}`);
    if (options.fill) props.push(`animation-fill-mode:${options.fill}`);
    if (options.delay !== undefined) props.push(`animation-delay:${num(options.delay)}s`);
    return `.a-${name}{${props.join(";")}}`;
  }

  css(): string {
    const base = `.a{animation-duration:${num(this.duration)}s;animation-iteration-count:infinite;animation-fill-mode:both;animation-timing-function:${this.baseTiming}}`;
    const entries = [...this.specs.entries()];
    if (entries.length === 0) return base;
    return [
      base,
      ...entries.map(([, spec]) => spec.block),
      ...entries.map(([name, spec]) => this.renderClass(name, spec.options)),
    ].join("\n\n");
  }
}
