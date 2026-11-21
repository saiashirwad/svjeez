import { Scene, type Mounted } from "@svjeez/react";
import { useState, type CSSProperties } from "react";
import tgpu, { common, d, std } from "typegpu";
import cardArt from "../gpu-card/index.tsx?svjeez&inline";

type Weather = "calm" | "storm";

// What the shader reads each frame: the time, how far the scene's storm clock has run, and the scheme's colors.
const Params = d.struct({
  time: d.f32,
  storm: d.f32,
  aspect: d.f32,
  ground: d.vec3f,
  calmA: d.vec3f,
  calmB: d.vec3f,
  stormA: d.vec3f,
  stormB: d.vec3f,
});

const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);

  return d.vec3f(r!, g!, b!);
};

// The scene's theme tokens, so the live field and the still fallback agree in both schemes.
const palettes = {
  dark: {
    ground: "#0F141E",
    calmA: "#64D2FF",
    calmB: "#5EA0FF",
    stormA: "#C58AFF",
    stormB: "#FF9F0A",
  },
  light: {
    ground: "#E8F0FF",
    calmA: "#1B9AAA",
    calmB: "#0A6CFF",
    stormA: "#9B51E0",
    stormB: "#E8751A",
  },
};

const hash = (p: d.v2f): number => {
  "use gpu";

  return std.fract(std.sin(std.dot(p, d.vec2f(127.1, 311.7))) * 43758.5453);
};

const noise = (p: d.v2f): number => {
  "use gpu";
  const cell = std.floor(p);
  const f = std.fract(p);
  const u = std.mul(std.mul(f, f), std.sub(d.vec2f(3), std.mul(f, 2)));
  const a = hash(cell);
  const b = hash(std.add(cell, d.vec2f(1, 0)));
  const c = hash(std.add(cell, d.vec2f(0, 1)));
  const e = hash(std.add(cell, d.vec2f(1, 1)));

  return std.mix(std.mix(a, b, u.x), std.mix(c, e, u.x), u.y);
};

/** Five octaves of noise, each twice as fine and half as strong. */
const fbm = (start: d.v2f): number => {
  "use gpu";
  let p = d.vec2f(start);
  let sum = d.f32(0);
  let weight = d.f32(0.5);

  for (let octave = 0; octave < 5; octave++) {
    sum += weight * noise(p);
    p = std.mul(p, 2.03);
    weight *= 0.5;
  }

  return sum;
};

/** Starts a WebGPU aurora on `canvas`, driven by `storm()`; resolves the function that stops it, or rejects without WebGPU. */
const aurora = async (canvas: HTMLCanvasElement, storm: () => number): Promise<() => void> => {
  const root = await tgpu.init();
  const context = root.configureContext({ canvas, alphaMode: "premultiplied" });
  const scheme = matchMedia("(prefers-color-scheme: dark)");

  const colors = () => {
    const palette = palettes[scheme.matches ? "dark" : "light"];

    return {
      ground: rgb(palette.ground),
      calmA: rgb(palette.calmA),
      calmB: rgb(palette.calmB),
      stormA: rgb(palette.stormA),
      stormB: rgb(palette.stormB),
    };
  };

  const params = root.createUniform(Params, { time: 0, storm: 0, aspect: 1, ...colors() });

  // Two noise fields warp a third; the storm speeds it up, roughens it and turns its colors.
  const field = (input: { uv: d.v2f }) => {
    "use gpu";
    const s = params.$.storm;
    const t = params.$.time * std.mix(0.12, 0.55, s);
    const p = d.vec2f(input.uv.x * params.$.aspect, input.uv.y);
    const scale = std.mix(1.3, 2.4, s);

    const q = d.vec2f(
      fbm(std.add(std.mul(p, scale), d.vec2f(t * 0.6, 0))),
      fbm(std.add(std.mul(p, scale), d.vec2f(5.2, 1.3 - t * 0.5))),
    );

    const n = fbm(
      std.add(std.add(std.mul(p, scale), std.mul(q, std.mix(1.2, 3.2, s))), d.vec2f(t, -t * 0.4)),
    );

    const bend = (n - 0.5) * std.mix(0.7, 1.1, s);
    const ribbon = std.exp(-std.pow((input.uv.y - 0.55 - bend) * std.mix(5, 3.2, s), 2));
    const second = std.exp(-std.pow((input.uv.y - 0.3 + bend * 0.6) * std.mix(9, 5, s), 2)) * 0.55;
    const streaks = std.smoothstep(0.58, 0.85, n) * s;
    const flicker = 1 + s * 0.2 * std.sin(params.$.time * 11 + p.x * 9);
    const a = std.mix(params.$.calmA, params.$.stormA, s);
    const b = std.mix(params.$.calmB, params.$.stormB, s);
    const band = std.mix(a, b, std.clamp(n * 1.4 - 0.2, 0, 1));
    const glow = std.clamp((ribbon + second) * flicker * 0.85 + n * 0.25 + streaks * 0.7, 0, 1);
    const edge = std.smoothstep(0, 0.12, std.min(input.uv.x, 1 - input.uv.x));

    return d.vec4f(std.mix(params.$.ground, band, glow * edge), 1);
  };

  const pipeline = root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: field,
  });

  const started = performance.now();
  let frame = 0;

  const draw = () => {
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(width * devicePixelRatio));
    const h = Math.max(1, Math.round(height * devicePixelRatio));

    if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });

    params.write({
      time: (performance.now() - started) / 1000,
      storm: storm(),
      aspect: w / h,
      ...colors(),
    });
    pipeline.withColorAttachment({ view: context }).draw(3);
    frame = requestAnimationFrame(draw);
  };

  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    root.destroy();
  };
};

// The canvas fills the slot, and rounds its corners as the scene's fallback does.
const CANVAS: Partial<CSSStyleDeclaration> = {
  display: "block",
  width: "100%",
  height: "100%",
  borderRadius: "12px",
};

/**
 * Hosts the live field in the scene's "field" slot once WebGPU is ready. Without WebGPU, init rejects and the scene's
 * own still aurora stays. The shader reads the storm clock every frame, so it turns as the SVG does.
 */
const live = (scene: Mounted) => {
  const slot = scene.slot("field");
  const clock = scene.clock("storm");
  const canvas = Object.assign(document.createElement("canvas"), { ariaHidden: "true" });
  let stop: (() => void) | undefined;
  let release: (() => void) | undefined;
  let gone = false;

  Object.assign(canvas.style, CANVAS);

  aurora(canvas, () => clock.time / clock.over).then(
    (end) => {
      if (gone) return end();
      stop = end;
      release = slot.host(canvas);
    },
    // No WebGPU here: the fallback is the picture.
    () => undefined,
  );

  return () => {
    gone = true;
    stop?.();
    release?.();
  };
};

const button: CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  padding: "0.5rem 1rem",
  borderRadius: 10,
  border: "1px solid light-dark(#D2D2D7, #3A3A3C)",
  background: "light-dark(#FFFFFF, #1C1C1E)",
  color: "inherit",
  cursor: "pointer",
};

// React owns the weather; the scene draws it and the shader follows the scene's storm clock.
export const GpuCard = () => {
  const [weather, setWeather] = useState<Weather>("calm");
  const next = weather === "calm" ? "storm" : "calm";

  return (
    <section style={{ display: "grid", gap: "0.75rem", maxWidth: 562 }}>
      <Scene scene={cardArt} state={weather} onMount={live} style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button type="button" style={button} onClick={() => setWeather(next)}>
          {weather === "calm" ? "Brew a storm" : "Calm it down"}
        </button>
        <p role="status" aria-live="polite" style={{ margin: 0 }}>
          {weather === "calm" ? "Calm: a slow, cool aurora." : "Storm: fast, turbulent and hot."}
        </p>
      </div>
    </section>
  );
};
