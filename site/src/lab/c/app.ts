// Direction C: time as a material. The flight is shown all at once over the compiled picture, and every drag rewrites
// the scene source, recompiles it in the playground's worker and shows the real SVG.
import { createCompiler } from "../compiler";
import { clamp, svgUrl } from "../util";
import {
  along,
  curve,
  DURATION,
  end,
  fly,
  HEIGHT,
  INITIAL,
  LATEST_END,
  MIN_OVER,
  points,
  sourceTokens,
  starts,
  WIDTH,
  type Flight,
  type Pt,
} from "./flight";

const NS = "http://www.w3.org/2000/svg";
const GHOST_STEP = 1 / 12;
const LEG_COLORS = ["#FF6B5B", "#F5A524", "#17B890", "#7C6CF2", "#E255A1", "#2E9BF0"];

type Drag =
  | { kind: "point"; index: number }
  | { kind: "trail"; leg: number; s: number; moved: boolean; t: number }
  | { kind: "edge"; leg: number; x0: number; flight: Flight }
  | { kind: "body"; leg: number; x0: number; flight: Flight }
  | { kind: "scrub" };

const svg = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
) => {
  const el = document.createElementNS(NS, tag);

  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));

  return el;
};

const round = (n: number, step: number) => Math.round(n / step) * step;
const fmt = (t: number) => `${t.toFixed(2)}s`;
const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`);

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KEYWORDS = /^(import|from|const|export|default|return|let|while|for|if|undefined)$/;

const highlight = (text: string) =>
  text.replace(
    /(\/\/[^\n]*)|("[^"\n]*"|`[^`\n]*`)|([A-Za-z_]\w*)|([^/"`A-Za-z_]+|.)/gs,
    (_, com, str, word, rest) => {
      if (com) return `<span class="c-com">${escape(com)}</span>`;

      if (str) return `<span class="c-str">${escape(str)}</span>`;

      if (word) return KEYWORDS.test(word) ? `<span class="c-kw">${word}</span>` : word;

      return escape(rest);
    },
  );

const feelWords = (f: number) =>
  Math.abs(f) < 0.08
    ? "steady"
    : f > 0
      ? f > 0.6
        ? "darts off, floats in"
        : "leaves fast, lands slow"
      : f < -0.6
        ? "creeps, then dives"
        : "leaves slow, lands fast";

interface Telemetry {
  compiles: { build: number; roundtrip: number; dragging: boolean }[];
  svg: string;
  frozen: boolean;
  now: number;
}

export const start = (root: HTMLElement) => {
  const img = root.querySelector<HTMLImageElement>(".lc-img")!;
  const stills = [...root.querySelectorAll<HTMLIFrameElement>(".lc-still")];
  const over = root.querySelector<SVGSVGElement>(".lc-over")!;
  const track = root.querySelector<HTMLElement>(".lc-track")!;
  const ruler = root.querySelector<HTMLElement>(".lc-ruler")!;
  const clock = root.querySelector<HTMLOutputElement>(".lc-clock")!;
  const stats = root.querySelector<HTMLElement>(".lc-stats")!;
  const code = root.querySelector<HTMLElement>(".lc-code code")!;
  const play = root.querySelector<HTMLButtonElement>(".lc-play")!;
  const hint = root.querySelector<HTMLElement>(".lc-hint")!;
  const compile = createCompiler();

  const telemetry: Telemetry = { compiles: [], svg: "", frozen: false, now: 0 };
  (window as unknown as { __labC: Telemetry }).__labC = telemetry;

  let flight: Flight = INITIAL;
  let drag: Drag | undefined;
  let hot: number | undefined;
  let frozen: number | undefined;
  let playStart = performance.now();
  let latestSvg = "";
  let imgUrl = "";
  let stillUrl = "";
  let shownStill = 0;
  let previousValues = new Map<string, string>();
  let previousStats = "";
  let inFlight = false;
  let queued = false;

  const DEFAULT_HINT =
    "Drag a white point to move the path. Drag along the dots to change the easing. Drag a block, or its right edge, to retime it. Drag the ruler to scrub.";

  const say = (text = DEFAULT_HINT) => {
    hint.textContent = text;
  };

  say();

  // Compiling. One build in flight at a time; edits made meanwhile coalesce into the next build.
  const rebuild = () => {
    if (inFlight) {
      queued = true;

      return;
    }

    inFlight = true;
    const sent = performance.now();

    const source = sourceTokens(flight)
      .map((t) => t.text)
      .join("");

    void compile(source).then((result) => {
      inFlight = false;
      telemetry.compiles.push({
        build: result.ms,
        roundtrip: performance.now() - sent,
        dragging: drag !== undefined,
      });

      if (result.ok) {
        latestSvg = result.svg;
        telemetry.svg = result.svg;
        showStats(result.stats.gzip, result.stats.keyframes, result.ms);

        if (frozen === undefined) showImg();
        else showStill(frozen);
      } else {
        stats.textContent = result.error.message;
      }

      if (queued) {
        queued = false;
        rebuild();
      }
    });
  };

  const showStats = (gzip: number, keyframes: number, ms: number) => {
    const key = `${gzip}|${keyframes}`;
    stats.innerHTML = `<span class="lc-stat${key !== previousStats ? " flash" : ""}"><b>${bytes(gzip)}</b> gzip</span><span class="lc-stat"><b>${keyframes}</b> keyframes</span><span class="lc-stat"><b>0 B</b> JS</span><span class="lc-stat"><b>${ms.toFixed(1)} ms</b> to build</span>`;
    previousStats = key;
  };

  const showImg = () => {
    if (!latestSvg) return;
    const old = imgUrl;
    imgUrl = svgUrl(latestSvg);
    img.src = imgUrl;
    img.addEventListener(
      "load",
      () => {
        playStart = performance.now();

        if (old) URL.revokeObjectURL(old);
      },
      { once: true },
    );
  };

  // The paused frame: the same compiled SVG in a document of its own, its animations stopped at t.
  const seek = (frame: HTMLIFrameElement, t: number) => {
    const doc = frame.contentDocument;

    if (!doc) return;

    for (const animation of doc.getAnimations()) {
      animation.pause();
      animation.currentTime = t * 1000;
    }

    const rootSvg = doc.documentElement as unknown as SVGSVGElement;
    rootSvg.pauseAnimations?.();
    rootSvg.setCurrentTime?.(t);
  };

  let stillSvg = "";

  const showStill = (t: number) => {
    root.dataset.frozen = "";
    const visible = stills[shownStill]!;

    if (stillSvg === latestSvg && visible.dataset.ready) {
      seek(visible, t);

      return;
    }

    stillSvg = latestSvg;
    const hidden = stills[1 - shownStill]!;
    const old = stillUrl;

    const fitted = latestSvg.replace(/<svg\b[^>]*>/, (tag) =>
      tag.replace(/\swidth="[^"]*"/, ' width="100%"').replace(/\sheight="[^"]*"/, ' height="100%"'),
    );

    stillUrl = svgUrl(fitted);
    hidden.dataset.ready = "";
    delete hidden.dataset.ready;
    hidden.onload = () => {
      seek(hidden, frozen ?? t);
      hidden.dataset.ready = "1";
      hidden.classList.add("on");
      visible.classList.remove("on");
      shownStill = 1 - shownStill;

      if (old) URL.revokeObjectURL(old);
    };

    hidden.src = stillUrl;
  };

  const freeze = (t: number) => {
    frozen = clamp(t, 0, DURATION - 0.001);
    telemetry.frozen = true;
    play.setAttribute("aria-label", "Play");
    root.dataset.frozen = "";

    if (latestSvg) showStill(frozen);
  };

  const resume = () => {
    frozen = undefined;
    telemetry.frozen = false;
    play.setAttribute("aria-label", "Pause");
    delete root.dataset.frozen;

    for (const s of stills) s.classList.remove("on");
    showImg();
  };

  const now = () =>
    frozen !== undefined
      ? frozen
      : ((((performance.now() - playStart) / 1000) % DURATION) + DURATION) % DURATION;

  // The overlay: the whole flight at once.
  const toScene = (event: PointerEvent): Pt => {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      over.getScreenCTM()!.inverse(),
    );

    return [p.x, p.y];
  };

  const nearestU = (leg: number, p: Pt) => {
    const pts = points(flight);
    let best = 0;
    let bestD = Infinity;

    for (let k = 0; k <= 200; k++) {
      const [x, y] = along(pts, leg, k / 200);
      const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;

      if (d < bestD) {
        bestD = d;
        best = k / 200;
      }
    }

    return best;
  };

  const solveFeel = (s: number, u: number) => {
    let lo = -1;
    let hi = 1;

    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;

      if (curve(s, mid) < u) lo = mid;
      else hi = mid;
    }

    return round((lo + hi) / 2, 0.01);
  };

  const ghostTimes = () => {
    const out: number[] = [];

    for (let t = flight.launch; t <= end(flight) + 1e-6; t += GHOST_STEP) out.push(t);

    return out;
  };

  // The overlay: the whole flight at once. Elements with listeners are made once and moved; only the dots are redrawn.
  over.append(
    svg("rect", { class: "lc-wing", x: -48, y: -8, width: 48, height: 316 }),
    svg("rect", { class: "lc-wing", x: WIDTH, y: -8, width: 48, height: 316 }),
  );
  const legLayer = svg("g");
  const onion = svg("g", { class: "lc-onion" });
  const dots = svg("g", { class: "lc-dots" });
  const nowDot = svg("circle", { class: "lc-now", r: 11 });
  const pointLayer = svg("g");
  const label = svg("text", { class: "lc-label", x: 0, y: 0 });
  over.append(legLayer, onion, dots, nowDot, pointLayer, label);

  const setHot = (next: number | undefined) => {
    if (hot === next) return;
    hot = next;
    applyHot();
  };

  const legViews = flight.legs.map((_, i) => {
    const g = svg("g", { class: "lc-leg", style: `--leg:${LEG_COLORS[i % LEG_COLORS.length]}` });
    const trail = svg("path", { class: "lc-trail" });
    const hit = svg("path", { class: "lc-hit" });
    g.append(trail, hit);
    legLayer.append(g);

    hit.addEventListener("pointerdown", (event) => {
      const u = nearestU(i, toScene(event));
      const legStarts = starts(flight);
      const leg = flight.legs[i]!;
      // The dot nearest the pointer along the path: its moment in time is what the drag holds still.
      let best = legStarts[i]!;
      let bestD = Infinity;

      for (const t of ghostTimes()) {
        const f = fly(flight, t);

        if (f.leg !== i) continue;

        if (Math.abs(f.u - u) < bestD) {
          bestD = Math.abs(f.u - u);
          best = t;
        }
      }

      const s = clamp((best - legStarts[i]!) / leg.over, 0.02, 0.98);
      begin(event, { kind: "trail", leg: i, s, moved: false, t: best });
      setHot(i);
      freeze(best);
      say(
        `Holding the moment ${fmt(best)} still. Slide it along the path: the dots bunch up where the plane is slow.`,
      );
    });
    hit.addEventListener("pointerenter", () => {
      if (drag) return;
      setHot(i);
      say(
        `Leg ${i + 1} ${feelWords(flight.legs[i]!.feel)}. Drag along its dots to change how it speeds up.`,
      );
    });
    hit.addEventListener("pointerleave", () => {
      if (drag) return;
      setHot(undefined);
      say();
    });

    return { g, trail, hit };
  });

  const pointViews = points(flight).map((_, index) => {
    const g = svg("g", {
      class: "lc-point",
      tabindex: 0,
      role: "slider",
      "aria-label": `Point ${index}`,
    });

    const text = svg("text", { "text-anchor": "middle" });
    g.append(
      svg("circle", { class: "lc-grip", r: 16 }),
      svg("circle", { class: "lc-knob", r: 7 }),
      text,
    );
    pointLayer.append(g);
    g.addEventListener("pointerdown", (event) => {
      begin(event, { kind: "point", index });
      setHot(index === 0 ? 0 : index - 1);
      freeze(arrival(index));
      say(`The plane is here at ${fmt(arrival(index))}, so time is held there while you drag.`);
    });
    g.addEventListener("pointerenter", () => {
      if (!drag) say(`Point ${index}: the plane passes here at ${fmt(arrival(index))}. Drag it.`);
    });
    g.addEventListener("pointerleave", () => {
      if (!drag) say();
    });

    return { g, text };
  });

  const arrival = (index: number) =>
    index === 0 ? flight.launch : starts(flight)[index - 1]! + flight.legs[index - 1]!.over;

  const drawDots = () => {
    const onions: SVGElement[] = [];
    const circles: SVGElement[] = [];
    ghostTimes().forEach((t, k) => {
      const f = fly(flight, t);

      if (k % 6 === 3)
        onions.push(
          svg("path", {
            d: "M-19 -12L22 0L-19 12L-11 0Z",
            transform: `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.rotate.toFixed(1)})`,
          }),
        );
      circles.push(
        svg("circle", {
          cx: f.x.toFixed(1),
          cy: f.y.toFixed(1),
          r: hot === f.leg ? 3.6 : 2.8,
          fill: LEG_COLORS[f.leg % LEG_COLORS.length]!,
          class: hot !== undefined && hot !== f.leg ? "dim" : "",
        }),
      );
    });
    onion.replaceChildren(...onions);
    dots.replaceChildren(...circles);
  };

  // Overlay units per CSS pixel, so handles and labels keep their size on a phone.
  let scale = 1;
  new ResizeObserver(() => {
    scale = Math.max(1, 736 / Math.max(1, over.clientWidth));
    over.style.setProperty("--k", String(scale));
    drawOverlay();
  }).observe(over);

  const drawOverlay = () => {
    const pts = points(flight);
    legViews.forEach(({ trail, hit }, i) => {
      let d = "";

      for (let k = 0; k <= 40; k++) {
        const [x, y] = along(pts, i, k / 40);
        d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }

      trail.setAttribute("d", d);
      hit.setAttribute("d", d);
    });
    pointViews.forEach(({ g, text }, index) => {
      const p = pts[index]!;
      g.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
      text.setAttribute("y", String((p[1] < 30 ? 26 : -14) * scale));
      text.textContent = fmt(arrival(index));
    });
    drawDots();
  };

  // The timeline.
  const pct = (t: number) => `${(t / DURATION) * 100}%`;

  for (let s = 0; s <= DURATION; s++) {
    const tick = document.createElement("span");
    tick.className = "lc-tick";
    tick.style.insetInlineStart = pct(s);
    tick.textContent = `${s}s`;
    ruler.append(tick);
  }

  const trackTime = (event: PointerEvent) => {
    const box = track.getBoundingClientRect();

    return clamp(((event.clientX - box.left) / box.width) * DURATION, 0, DURATION - 0.001);
  };

  const speedProfile = (i: number) => {
    const pts = points(flight);
    const leg = flight.legs[i]!;

    return Array.from({ length: 25 }, (_, k) => {
      const s = clamp(k / 24, 0.001, 0.999);

      const du =
        (curve(Math.min(1, s + 0.001), leg.feel) - curve(Math.max(0, s - 0.001), leg.feel)) / 0.002;

      const [dx, dy] = along(pts, i, curve(s, leg.feel), 1);

      return (Math.hypot(dx, dy) * du) / leg.over;
    });
  };

  const waitBlock = document.createElement("div");
  waitBlock.className = "lc-block lc-wait";
  const tailBlock = document.createElement("div");
  tailBlock.className = "lc-block lc-wait";
  const playhead = document.createElement("div");
  playhead.className = "lc-playhead";

  const blockViews = flight.legs.map((_, i) => {
    const block = document.createElement("div");
    block.className = "lc-block";
    block.style.setProperty("--leg", LEG_COLORS[i % LEG_COLORS.length]!);
    block.innerHTML = `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path/></svg><span class="lc-block-label"></span><span class="lc-edge" aria-hidden="true"></span>`;
    block.addEventListener("pointerdown", (event) => {
      const onEdge = (event.target as HTMLElement).classList.contains("lc-edge");
      const legStart = starts(flight)[i]!;
      begin(event, { kind: onEdge ? "edge" : "body", leg: i, x0: event.clientX, flight });
      setHot(i);
      freeze(onEdge ? legStart + flight.legs[i]!.over : legStart);
      say(
        onEdge
          ? `Stretching leg ${i + 1}; everything after it moves along. Hold Alt to borrow the time from the next leg instead.`
          : `Sliding leg ${i + 1} in time. The leg before it takes up the slack.`,
      );
    });
    block.addEventListener("pointerenter", () => {
      if (drag) return;
      setHot(i);
      say(
        `Leg ${i + 1} lasts ${flight.legs[i]!.over.toFixed(2)}s. The hill inside is its speed. Drag the block to shift it, its edge to stretch it.`,
      );
    });
    block.addEventListener("pointerleave", () => {
      if (drag) return;
      setHot(undefined);
      say();
    });
    track.append(block);

    return {
      block,
      path: block.querySelector("path")!,
      label: block.querySelector<HTMLElement>(".lc-block-label")!,
    };
  });

  track.prepend(waitBlock);
  track.append(tailBlock, playhead);

  const drawTrack = () => {
    const legStarts = starts(flight);
    const profiles = flight.legs.map((_, i) => speedProfile(i));
    const top = Math.max(...profiles.flat(), 1);

    waitBlock.style.insetInlineStart = "0";
    waitBlock.style.inlineSize = pct(flight.launch);
    blockViews.forEach(({ block, path, label: text }, i) => {
      const leg = flight.legs[i]!;
      block.style.insetInlineStart = pct(legStarts[i]!);
      block.style.inlineSize = pct(leg.over);

      const area = profiles[i]!.map(
        (v, k) => `${((k / 24) * 100).toFixed(1)} ${(40 - (v / top) * 32).toFixed(1)}`,
      ).join(" L");

      path.setAttribute("d", `M0 40 L${area} L100 40Z`);
      text.textContent = `${leg.over.toFixed(2)}s`;
    });
    tailBlock.style.insetInlineStart = pct(end(flight));
    tailBlock.style.inlineSize = pct(DURATION - end(flight));
  };

  ruler.addEventListener("pointerdown", (event) => {
    begin(event, { kind: "scrub" });
    freeze(trackTime(event));
    say(
      "Scrubbing. Each frame is the compiled SVG paused at that moment. Press space or play to let it run.",
    );
  });
  playhead.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    begin(event, { kind: "scrub" });
    freeze(trackTime(event));
  });

  // The code, with the values the lab edits flashing as they change.
  const drawCode = () => {
    const values = new Map<string, string>();
    let html = "";

    for (const token of sourceTokens(flight)) {
      if (token.id) {
        values.set(token.id, token.text);
        const changed = previousValues.size > 0 && previousValues.get(token.id) !== token.text;
        html += `<span class="c-val${changed ? " flash" : ""}" data-id="${token.id}">${token.text}</span>`;
      } else {
        html += highlight(token.text);
      }
    }

    previousValues = values;
    let legLine = 0;
    code.innerHTML = html
      .split("\n")
      .map((line) => {
        if (!line.startsWith("  { to: ")) return line;
        const i = legLine++;

        return `<span class="c-leg" data-leg="${i}" style="--leg:${LEG_COLORS[i % LEG_COLORS.length]}">${line}</span>`;
      })
      .join("\n");
    applyHot();
  };

  const applyHot = () => {
    legViews.forEach(({ g }, i) => g.classList.toggle("hot", hot === i));
    blockViews.forEach(({ block }, i) => block.classList.toggle("hot", hot === i));
    code
      .querySelectorAll<HTMLElement>(".c-leg")
      .forEach((line) => line.classList.toggle("hot", String(hot) === line.dataset.leg));
    drawDots();
  };

  const render = () => {
    drawOverlay();
    drawTrack();
    drawCode();
  };

  // Dragging.
  const begin = (event: PointerEvent, next: Drag) => {
    event.preventDefault();
    drag = next;
    root.dataset.dragging = next.kind;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  };

  const setFlight = (next: Flight) => {
    flight = next;
    render();
    rebuild();
  };

  const withLegs = (legs: Flight["legs"]) => ({ ...flight, legs });

  const showLabel = (p: Pt, text: string) => {
    if (!label) return;
    label.setAttribute("x", String(clamp(p[0], 30, WIDTH - 30)));
    label.setAttribute("y", String(clamp(p[1] - 34 * scale, 14 * scale, HEIGHT - 6)));
    label.textContent = text;
  };

  const move = (event: PointerEvent) => {
    if (!drag) return;
    const d = drag;

    if (d.kind === "point") {
      const [x, y] = toScene(event);
      const p: Pt = [Math.round(clamp(x, -44, WIDTH + 44)), Math.round(clamp(y, 4, HEIGHT - 4))];

      if (d.index === 0) setFlight({ ...flight, from: p });
      else
        setFlight(
          withLegs(flight.legs.map((leg, i) => (i === d.index - 1 ? { ...leg, to: p } : leg))),
        );

      const arrive =
        d.index === 0
          ? flight.launch
          : starts(flight)[d.index - 1]! + flight.legs[d.index - 1]!.over;

      freeze(arrive);
      showLabel(p, `[${p[0]}, ${p[1]}]`);

      return;
    }

    if (d.kind === "trail") {
      const p = toScene(event);
      const u = nearestU(d.leg, p);
      const feel = solveFeel(d.s, u);
      d.moved = true;
      setFlight(withLegs(flight.legs.map((leg, i) => (i === d.leg ? { ...leg, feel } : leg))));
      const f = fly(flight, d.t);
      showLabel([f.x, f.y], `feel ${feel.toFixed(2)} · ${feelWords(feel)}`);
      freeze(d.t);

      return;
    }

    if (d.kind === "scrub") {
      freeze(trackTime(event));

      return;
    }

    const box = track.getBoundingClientRect();
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

      setFlight({ ...base, legs });
      freeze(starts(flight)[d.leg]! + flight.legs[d.leg]!.over);

      return;
    }

    let launch = base.launch;

    if (d.leg === 0)
      launch = round(clamp(base.launch + dt, 0, base.launch + LATEST_END - baseEnd), 0.01);
    else {
      const prev = legs[d.leg - 1]!;
      prev.over = round(clamp(prev.over + dt, MIN_OVER, prev.over + LATEST_END - baseEnd), 0.01);
    }

    setFlight({ ...base, launch, legs });
    freeze(starts(flight)[d.leg]!);
  };

  const finish = () => {
    const d = drag;
    drag = undefined;
    delete root.dataset.dragging;
    window.removeEventListener("pointermove", move);

    if (label) label.textContent = "";
    hot = undefined;
    render();
    say();

    // A plain click on the trail, or a scrub, leaves time paused there; an edit plays the new flight from the top.
    if (d?.kind === "scrub" || (d?.kind === "trail" && !d.moved)) return;
    resume();
  };

  play.addEventListener("click", () => (frozen === undefined ? freeze(now()) : resume()));
  window.addEventListener("keydown", (event) => {
    if (event.key !== " " || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    play.click();
  });

  const tick = () => {
    const t = now();
    telemetry.now = t;
    clock.textContent = fmt(t);
    playhead.style.insetInlineStart = pct(t);
    {
      const inFlight = t >= flight.launch && t <= end(flight);
      const f = fly(flight, t);
      nowDot.setAttribute("cx", f.x.toFixed(1));
      nowDot.setAttribute("cy", f.y.toFixed(1));
      nowDot.classList.toggle("off", !inFlight);
    }

    requestAnimationFrame(tick);
  };

  render();
  rebuild();
  requestAnimationFrame(tick);
};
