import { Scene, type Mounted } from "@svjeez/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import fields from "./scenes/fields.tsx?svjeez&inline";
import file from "./scenes/fields.tsx?raw";
import {
  BOTTOM,
  CHARGES,
  HEIGHT,
  LEFT,
  PROBE,
  RIGHT,
  TOP,
  UNIT,
  WIDTH,
  sample,
} from "./scenes/field";
import { Source, trimmed } from "./source";
import type { Vec } from "svjeez";

const CODE = trimmed(file);

/** Which layer the stage shows: both, only the vector one svjeez draws, or only the field the GPU draws. */
const LAYERS = [
  { show: "both", label: "Both", key: "1" },
  { show: "svg", label: "SVG · svjeez", key: "2" },
  { show: "gpu", label: "GPU · TypeGPU", key: "3" },
] as const;

type Show = (typeof LAYERS)[number]["show"];

/** How far peeling lifts the vector layer, in scene units: the scene's own "peeled" offset. */
const LIFT = -14;

type Name = (typeof CHARGES)[number]["name"] | "p";

interface Handle {
  readonly name: Name;
  readonly label: string;
}

const HANDLES: readonly Handle[] = [
  ...CHARGES.map(({ name, q }) => ({
    name,
    label: `Charge ${q > 0 ? "+" : "−"}${Math.abs(q) === 1 ? "" : Math.abs(q)}q`,
  })),
  { name: "p", label: "Probe" },
];

// SAFETY: CHARGES holds one entry for each of a, b, c and d, and p is the probe, added here.
const START = {
  ...Object.fromEntries(CHARGES.map(({ name, at }) => [name, at])),
  p: PROBE,
} as Record<Name, Vec>;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const within = ([x, y]: Vec): Vec => [clamp(x, LEFT, RIGHT), clamp(y, TOP, BOTTOM)];
const units = (value: number) => (value / UNIT).toFixed(1);

/** What the probe reads where it stands, from where the charges are. */
const reading = (places: Record<Name, Vec>) => {
  const { e, phi } = sample(
    places.p,
    CHARGES.map(({ name, q }) => ({ q, at: places[name] })),
  );

  const strength = Math.hypot(e[0], e[1]);

  return { e, phi, strength, angle: Math.atan2(e[1], e[0]) };
};

/**
 * Moves every clock: each thing's x and y as progress across its range, which the vector layer and the shader both
 * turn back into the same place, and the probe's readout, worked out here and shown by the vector layer.
 */
const show = (scene: Mounted, places: Record<Name, Vec>) => {
  for (const { name } of HANDLES) {
    const [x, y] = places[name];

    scene.clock(`${name}x`).progress((x - LEFT) / (RIGHT - LEFT));
    scene.clock(`${name}y`).progress((y - TOP) / (BOTTOM - TOP));
  }

  const { phi, strength, angle } = reading(places);

  scene.clock("heading").progress((angle / Math.PI + 1) / 2);
  scene.clock("reach").progress((1 - Math.exp(-strength / 1.2) - 0.12) / 0.88);
  scene.clock("strength").progress((Math.log10(Math.max(strength, 0.01)) + 2) / 4);
  scene.clock("potential").progress((phi + 8) / 16);
};

export const App = () => {
  const scene = useRef<Mounted>(undefined);
  const stage = useRef<HTMLDivElement>(null);
  const grab = useRef<{ name: Name; from: Vec; at: Vec } | undefined>(undefined);
  const [places, setPlaces] = useState(START);
  const [peeled, setPeeled] = useState(false);
  const [open, setOpen] = useState(false);
  const [moved, setMoved] = useState(false);
  const [layer, setLayer] = useState<Show>("both");

  useEffect(() => {
    if (scene.current) show(scene.current, places);
  }, [places]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;

      if (event.key === "l" || event.key === "L") setPeeled((was) => !was);

      if (event.key === "Escape") setOpen(false);

      const picked = LAYERS.find(({ key }) => key === event.key);

      if (picked) setLayer(picked.show);
    };

    addEventListener("keydown", onKey);

    return () => removeEventListener("keydown", onKey);
  }, []);

  /** The pointer's place in scene units. */
  const toScene = (event: PointerEvent): Vec => {
    const box = stage.current!.getBoundingClientRect();

    return [
      ((event.clientX - box.left) / box.width) * WIDTH,
      ((event.clientY - box.top) / box.height) * HEIGHT,
    ];
  };

  const move = (name: Name, to: Vec) => {
    setMoved(true);
    setPlaces((was) => ({ ...was, [name]: within(to) }));
  };

  const onDown = (name: Name) => (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    grab.current = { name, from: toScene(event), at: places[name] };
  };

  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    const held = grab.current;

    if (!held) return;
    const [x, y] = toScene(event);

    move(held.name, [held.at[0] + x - held.from[0], held.at[1] + y - held.from[1]]);
  };

  const onUp = () => (grab.current = undefined);

  const onNudge = (name: Name) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 50 : 10;

    const by = new Map<string, Vec>([
      ["ArrowLeft", [-step, 0]],
      ["ArrowRight", [step, 0]],
      ["ArrowUp", [0, -step]],
      ["ArrowDown", [0, step]],
    ]);

    const delta = by.get(event.key);

    if (!delta) return;
    event.preventDefault();
    move(name, [places[name][0] + delta[0], places[name][1] + delta[1]]);
  };

  const probe = reading(places);

  return (
    <main className={open ? "open" : undefined}>
      <div className="stage" ref={stage} data-show={layer}>
        <Scene
          scene={fields}
          state={peeled ? "peeled" : "flat"}
          onMount={(mounted) => {
            scene.current = mounted;
            show(mounted, places);

            return () => (scene.current = undefined);
          }}
        />
        <div
          className="handles"
          style={{
            transform: peeled
              ? `translate(${(LIFT / WIDTH) * 100}%, ${(LIFT / HEIGHT) * 100}%)`
              : undefined,
          }}
        >
          {HANDLES.map(({ name, label }) => (
            <button
              key={name}
              type="button"
              className={name === "p" ? "handle probe" : "handle"}
              style={{
                left: `${(places[name][0] / WIDTH) * 100}%`,
                top: `${(places[name][1] / HEIGHT) * 100}%`,
              }}
              aria-label={`${label} at x ${units(places[name][0])} u, y ${units(places[name][1])} u`}
              aria-roledescription="movable point"
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
              onPointerDown={onDown(name)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={onNudge(name)}
            />
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {`Field at the probe: ${probe.strength.toFixed(2)} q per u, potential ${probe.phi.toFixed(1)}.`}
      </p>
      <div className="controls">
        <div className="layers" role="radiogroup" aria-label="Show layer">
          {LAYERS.map(({ show, label, key }) => (
            <button
              key={show}
              type="button"
              role="radio"
              aria-checked={layer === show}
              aria-keyshortcuts={key}
              onClick={() => setLayer(show)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={peeled}
          aria-keyshortcuts="L"
          onClick={() => setPeeled((was) => !was)}
        >
          Peel layers <kbd>L</kbd>
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="source"
          onClick={() => setOpen((was) => !was)}
        >
          Source
        </button>
      </div>
      <aside id="source" className="source" hidden={!open} aria-label="The scene's source">
        <header>
          <span>scenes/fields.tsx</span>
          <span className="legend">
            <i /> "use gpu": compiled to WGSL, runs per pixel
          </span>
          <button type="button" aria-label="Close source" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <Source code={CODE} />
      </aside>
      <p className={moved ? "hint gone" : "hint"} aria-hidden>
        drag a charge or the probe · 1 2 3 show each layer · L peels them apart
      </p>
      <p className="lockup">
        <a href="https://svjeez.texoport.in">svjeez</a> <span aria-label="loves">♥</span>{" "}
        <a href="https://docs.swmansion.com/TypeGPU/">TypeGPU</a>
      </p>
    </main>
  );
};
