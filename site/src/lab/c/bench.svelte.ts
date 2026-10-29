// Direction C: time as a material. The flight is shown all at once over the compiled picture, and every drag rewrites
// the scene source, recompiles it in the playground's worker and shows the real SVG.
import { createContext } from "svelte";
import { restyle } from "svjeez";
import { createCompiler, latestWins } from "@svjeez/live/client";
import { clamp, svgUrl } from "../util";
import {
  curve,
  DURATION,
  end,
  fly,
  HEIGHT,
  INITIAL,
  LATEST_END,
  MIN_OVER,
  route,
  sourceOf,
  starts,
  WIDTH,
  type Flight,
  type Pt,
} from "./flight";
import first from "./plane.tsx?svjeez";
import { feelWords, fmt, ghostTimes, round } from "./view";

type Drag =
  | { kind: "point"; index: number }
  | { kind: "trail"; leg: number; s: number; moved: boolean; t: number }
  | { kind: "edge"; leg: number; x0: number; flight: Flight }
  | { kind: "body"; leg: number; x0: number; flight: Flight }
  | { kind: "scrub" };

type Status =
  | { ok: true; gzip: number; keyframes: number; ms: number }
  | { ok: false; message: string };

interface Telemetry {
  compiles: { build: number; roundtrip: number; dragging: boolean }[];
  svg: string;
  frozen: boolean;
  now: number;
}

declare global {
  interface Window {
    __labC?: Telemetry;
  }
}

const DEFAULT_HINT =
  "Drag a white point to move the path. Drag along the dots to change the easing. Drag a block, or its right edge, to retime it. Drag the ruler to scrub.";

export class Bench {
  flight = $state.raw<Flight>(INITIAL);
  /** The leg under the pointer or being dragged. */
  hot = $state<number>();
  /** The moment time is held at, or undefined while the plane flies. */
  frozen = $state<number>();
  hint = $state(DEFAULT_HINT);
  drag = $state.raw<Drag>();
  /** The most recent file that compiled. */
  svg = $state.raw("");
  status = $state.raw<Status>();
  /** The picture on show, playing or held at `frozen`: the build's own file until the first compile answers. */
  imgUrl = $state(first.src);
  /** The clock: the held moment, or where the playing picture is. */
  time = $state(0);
  label = $state.raw<{ at: Pt; text: string }>();
  source = $derived(sourceOf(this.flight));

  /** Set by the components that own these elements. */
  over: SVGSVGElement | undefined;
  track: HTMLElement | undefined;

  telemetry: Telemetry = { compiles: [], svg: "", frozen: false, now: 0 };

  #playStart = performance.now();
  /** The picture waiting for the one being decoded, so a scrub only ever decodes the latest moment. */
  #nextPicture: { at: number; paused: boolean } | undefined;
  #painting = false;
  #compiler: ReturnType<typeof createCompiler> | undefined;
  #queue = latestWins<string>((text) => this.#compile(text));

  build = (text: string) => this.#queue(text);

  /** Starts the clock. Attach it to an element; it stops when the element goes. */
  run = () => {
    window.__labC = this.telemetry;
    this.#playStart = performance.now();

    let frame = 0;

    const tick = () => {
      this.time = this.telemetry.now = this.#now();
      frame = requestAnimationFrame(tick);
    };

    tick();

    return () => cancelAnimationFrame(frame);
  };

  async #compile(text: string) {
    const compile = (this.#compiler ??= createCompiler());
    const sent = performance.now();
    const result = await compile(text);

    this.telemetry.compiles.push({
      build: result.ms,
      roundtrip: performance.now() - sent,
      dragging: this.drag !== undefined,
    });

    if (!result.ok) {
      this.status = { ok: false, message: result.error.message };

      return;
    }

    this.telemetry.svg = this.svg = result.svg;
    this.status = {
      ok: true,
      gzip: result.stats.gzip,
      keyframes: result.stats.keyframes,
      ms: result.ms,
    };

    this.#show(this.#now());
  }

  /** Shows the compiled file `at` seconds in, held there or playing on, once it has decoded. */
  #show(at: number, paused = this.frozen !== undefined) {
    this.#nextPicture = { at, paused };

    if (!this.#painting) void this.#paint();
  }

  async #paint() {
    this.#painting = true;

    for (let next = this.#nextPicture; next && this.svg; next = this.#nextPicture) {
      this.#nextPicture = undefined;
      const url = svgUrl(restyle(this.svg, next));
      const probe = new Image();
      probe.src = url;
      await probe.decode().catch(() => {});

      if (!next.paused) this.#playStart = performance.now() - next.at * 1000;
      const old = this.imgUrl;
      this.imgUrl = url;

      if (old.startsWith("blob:")) URL.revokeObjectURL(old);
    }

    this.#painting = false;
  }

  #now() {
    return (
      this.frozen ??
      ((((performance.now() - this.#playStart) / 1000) % DURATION) + DURATION) % DURATION
    );
  }

  say = (text = DEFAULT_HINT) => {
    this.hint = text;
  };

  freeze = (t: number) => {
    this.frozen = clamp(t, 0, DURATION - 0.001);
    this.telemetry.frozen = true;
    this.#show(this.frozen, true);
  };

  /** Plays on from `at`, by default the moment time is held at. */
  resume = (at = this.frozen ?? this.#now()) => {
    this.frozen = undefined;
    this.telemetry.frozen = false;
    this.#playStart = performance.now() - at * 1000;
    this.#show(at, false);
  };

  toggle = () => {
    if (this.frozen === undefined) this.freeze(this.#now());
    else this.resume();
  };

  /** When the plane reaches point `index`. */
  arrival = (index: number) =>
    index === 0
      ? this.flight.launch
      : starts(this.flight)[index - 1]! + this.flight.legs[index - 1]!.over;

  // Hovering.
  hoverTrail = (leg: number) => {
    if (this.drag) return;
    this.hot = leg;
    this.say(
      `Leg ${leg + 1} ${feelWords(this.flight.legs[leg]!.feel)}. Drag along its dots to change how it speeds up.`,
    );
  };

  hoverBlock = (leg: number) => {
    if (this.drag) return;
    this.hot = leg;
    this.say(
      `Leg ${leg + 1} lasts ${this.flight.legs[leg]!.over.toFixed(2)}s. The hill inside is its speed. Drag the block to shift it, its edge to stretch it.`,
    );
  };

  leaveLeg = () => {
    if (this.drag) return;
    this.hot = undefined;
    this.say();
  };

  hoverPoint = (index: number) => {
    if (!this.drag)
      this.say(`Point ${index}: the plane passes here at ${fmt(this.arrival(index))}. Drag it.`);
  };

  leavePoint = () => {
    if (!this.drag) this.say();
  };

  // Pressing starts a drag.
  #begin(event: PointerEvent, next: Drag) {
    event.preventDefault();
    this.drag = next;

    if (event.currentTarget instanceof Element)
      event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  pressPoint = (event: PointerEvent, index: number) => {
    this.#begin(event, { kind: "point", index });
    this.hot = index === 0 ? 0 : index - 1;
    this.freeze(this.arrival(index));
    this.say(
      `The plane is here at ${fmt(this.arrival(index))}, so time is held there while you drag.`,
    );
  };

  pressTrail = (event: PointerEvent, i: number) => {
    const u = this.#nearestU(i, this.#toScene(event));
    const legStarts = starts(this.flight);
    const leg = this.flight.legs[i]!;
    // The dot nearest the pointer along the path: its moment in time is what the drag holds still.
    let best = legStarts[i]!;
    let bestD = Infinity;

    for (const t of ghostTimes(this.flight)) {
      const f = fly(this.flight, t);

      if (f.leg !== i) continue;

      if (Math.abs(f.u - u) < bestD) {
        bestD = Math.abs(f.u - u);
        best = t;
      }
    }

    const s = clamp((best - legStarts[i]!) / leg.over, 0.02, 0.98);
    this.#begin(event, { kind: "trail", leg: i, s, moved: false, t: best });
    this.hot = i;
    this.freeze(best);
    this.say(
      `Holding the moment ${fmt(best)} still. Slide it along the path: the dots bunch up where the plane is slow.`,
    );
  };

  pressBlock = (event: PointerEvent, i: number, onEdge = false) => {
    const legStart = starts(this.flight)[i]!;

    this.#begin(event, {
      kind: onEdge ? "edge" : "body",
      leg: i,
      x0: event.clientX,
      flight: this.flight,
    });
    this.hot = i;
    this.freeze(onEdge ? legStart + this.flight.legs[i]!.over : legStart);
    this.say(
      onEdge
        ? `Stretching leg ${i + 1}; everything after it moves along. Hold Alt to borrow the time from the next leg instead.`
        : `Sliding leg ${i + 1} in time. The leg before it takes up the slack.`,
    );
  };

  pressScrub = (event: PointerEvent, say = true) => {
    this.#begin(event, { kind: "scrub" });
    this.freeze(this.#trackTime(event));

    if (say)
      this.say(
        "Scrubbing. Each frame is the compiled SVG paused at that moment. Press space or play to let it run.",
      );
  };

  // Dragging.
  move = (event: PointerEvent) => {
    const d = this.drag;

    if (!d) return;

    const flight = this.flight;

    if (d.kind === "point") {
      const [x, y] = this.#toScene(event);
      const p: Pt = [Math.round(clamp(x, -44, WIDTH + 44)), Math.round(clamp(y, 4, HEIGHT - 4))];

      if (d.index === 0) this.flight = { ...flight, from: p };
      else
        this.flight = {
          ...flight,
          legs: flight.legs.map((leg, i) => (i === d.index - 1 ? { ...leg, to: p } : leg)),
        };

      this.freeze(this.arrival(d.index));
      this.label = { at: p, text: `[${p[0]}, ${p[1]}]` };

      return;
    }

    if (d.kind === "trail") {
      const u = this.#nearestU(d.leg, this.#toScene(event));
      const feel = this.#solveFeel(d.s, u);
      d.moved = true;
      this.flight = {
        ...flight,
        legs: flight.legs.map((leg, i) => (i === d.leg ? { ...leg, feel } : leg)),
      };
      const f = fly(this.flight, d.t);
      this.label = { at: [f.x, f.y], text: `feel ${feel.toFixed(2)} · ${feelWords(feel)}` };
      this.freeze(d.t);

      return;
    }

    if (d.kind === "scrub") {
      this.freeze(this.#trackTime(event));

      return;
    }

    const box = this.track!.getBoundingClientRect();
    const dt = round(((event.clientX - d.x0) / box.width) * DURATION, 0.05);
    const base = d.flight;
    const baseEnd = end(base);
    const legs = base.legs.map((leg) => ({ ...leg }));

    if (d.kind === "edge") {
      const leg = legs[d.leg]!;
      const nextLeg = legs[d.leg + 1];

      if (event.altKey && nextLeg) {
        const shift = clamp(dt, MIN_OVER - leg.over, nextLeg.over - MIN_OVER);
        leg.over = round(leg.over + shift, 0.01);
        nextLeg.over = round(nextLeg.over - shift, 0.01);
      } else {
        leg.over = round(clamp(leg.over + dt, MIN_OVER, leg.over + LATEST_END - baseEnd), 0.01);
      }

      this.flight = { ...base, legs };
      this.freeze(starts(this.flight)[d.leg]! + this.flight.legs[d.leg]!.over);

      return;
    }

    let launch = base.launch;

    if (d.leg === 0)
      launch = round(clamp(base.launch + dt, 0, base.launch + LATEST_END - baseEnd), 0.01);
    else {
      const prev = legs[d.leg - 1]!;
      prev.over = round(clamp(prev.over + dt, MIN_OVER, prev.over + LATEST_END - baseEnd), 0.01);
    }

    this.flight = { ...base, launch, legs };
    this.freeze(starts(this.flight)[d.leg]!);
  };

  finish = () => {
    const d = this.drag;

    if (!d) return;

    this.drag = undefined;
    this.label = undefined;
    this.hot = undefined;
    this.say();

    // A plain click on the trail, or a scrub, leaves time paused there; an edit plays the new flight from the top.
    if (d.kind === "scrub" || (d.kind === "trail" && !d.moved)) return;
    this.resume(0);
  };

  #toScene(event: PointerEvent): Pt {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      this.over!.getScreenCTM()!.inverse(),
    );

    return [p.x, p.y];
  }

  #trackTime(event: PointerEvent) {
    const box = this.track!.getBoundingClientRect();

    return clamp(((event.clientX - box.left) / box.width) * DURATION, 0, DURATION - 0.001);
  }

  #nearestU(leg: number, [x, y]: Pt) {
    return route(this.flight).nearest({ x, y }, leg, leg + 1) - leg;
  }

  #solveFeel(s: number, u: number) {
    let lo = -1;
    let hi = 1;

    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;

      if (curve(s, mid) < u) lo = mid;
      else hi = mid;
    }

    return round((lo + hi) / 2, 0.01);
  }
}

export const [getBench, setBench] = createContext<Bench>();
