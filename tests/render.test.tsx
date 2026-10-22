import { describe, expect, test } from "bun:test";
import { def, draw, ease, enter, exit, motion, render, wiggle, type Child } from "svg-motion";

const scene = (content: Child, duration = 10) => render({ width: 100, height: 100, duration, title: "Test" }, content);

const body = (svg: string) => svg.slice(svg.indexOf("</style>"));

const keyframes = (svg: string) => [...svg.matchAll(/@keyframes ([\w-]+)\{(.*)\}$/gm)].map((match) => match[2]!);

describe("motion timing", () => {
  test("an ease shapes the transition it is passed to, so CSS gets it on that transition's start key", () => {
    const svg = scene(<rect width={10} height={10} animation={motion().at(1).to({ opacity: 0 }, 1, ease.inOut).at(5).to({ opacity: 1 }, 1)} />);
    expect(svg).toContain("10%{opacity:1;animation-timing-function:cubic-bezier(.77,0,.175,1)}");
    expect(svg).not.toMatch(/20%[^{]*\{opacity:0;animation-timing-function/);
  });

  test("values hold between transitions without hand-written holds", () => {
    const svg = scene(<rect width={10} height={10} animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1)} />);
    expect(keyframes(svg)).toEqual(["0%,20%{opacity:0}30%,100%{opacity:1}"]);
  });

  test("a loop period snaps to divide the scene", () => {
    const svg = scene(<rect width={10} height={10} animation={motion({ opacity: 1 }).at(0.55).set({ opacity: 0 }).loop(1.1)} />);
    expect(svg).toContain("animation-duration:1.111s");
    expect(keyframes(svg)).toEqual(["0%{opacity:1}50%,100%{opacity:0}"]);
  });

  test("identical lanes share one @keyframes and one class", () => {
    const fade = () => enter({ at: 1, over: 0.5 });
    const svg = scene(
      <>
        <rect width={10} height={10} animation={fade()} />
        <circle r={4} animation={fade()} />
      </>,
    );
    expect(keyframes(svg)).toHaveLength(1);
    expect(svg.match(/class="a m1"/g)).toHaveLength(2);
  });
});

describe("requirements", () => {
  test("draw adds pathLength and dasharray to its element", () => {
    const svg = scene(<path d="M0 0H10" stroke="#fff" animation={draw({ at: 0, over: 1 })} />);
    expect(svg).toContain('pathLength="1" stroke-dasharray="1"');
  });

  test("draw refuses an author value that would break it", () => {
    expect(() => scene(<path d="M0 0H10" pathLength={2} animation={draw({ at: 0, over: 1 })} />)).toThrow(/pathLength/);
  });
});

describe("stacking", () => {
  test("motions on disjoint lanes share the element", () => {
    const svg = scene(<rect width={10} height={10} animation={[enter({ at: 0, over: 1 }), motion().at(2).to({ scale: 2 }, 1)]} />);
    expect(body(svg)).not.toContain("<g");
  });

  test("motions on the same lane get exactly one wrapper", () => {
    const svg = scene(<rect width={10} height={10} animation={[enter({ at: 0, over: 1 }), exit({ at: 8, over: 1 })]} />);
    expect(body(svg).match(/<g /g)).toHaveLength(1);
    expect(body(svg)).toMatch(/<g class="a m\d+">\s*<rect [^>]*class="a m\d+"\/>\s*<\/g>/);
  });

  test("two motions on one replace lane are an error", () => {
    const fill = (at: number) => motion().at(at).to({ fill: "#fff" }, 1);
    expect(() => scene(<rect width={10} height={10} fill="#000" animation={[fill(1), fill(5)]} />)).toThrow(/fill/);
  });

  test("scale on text pivots on a wrapper, since WebKit ignores fill-box on <text>", () => {
    const svg = scene(<text animation={motion().to({ scale: 2 }, 1)}>hi</text>);
    expect(body(svg)).toMatch(/<g class="a m1 fb">\s*<text>hi<\/text>/);
  });

  test("scale on an element with a transform attribute wraps instead of re-pivoting it", () => {
    const svg = scene(<rect width={10} height={10} transform="rotate(45)" animation={motion().to({ scale: 2 }, 1)} />);
    expect(body(svg)).toMatch(/<g class="a m1 fb">\s*<rect width="10" height="10" transform="rotate\(45\)"\/>/);
  });
});

describe("defs", () => {
  const tree = () => {
    const unused = def.linearGradient({}, <stop offset={0} stopColor="#000" />);
    const card = def.clipPath({}, <rect width={10} height={10} />);
    const bg = def.linearGradient({ x2: 1 }, <stop offset={0} stopColor="#fff" />);
    void unused;
    return (
      <g clipPath={card}>
        <rect width={10} height={10} fill={bg} />
        <rect width={10} height={10} fill={bg} />
      </g>
    );
  };

  test("only referenced defs are emitted, with ids in first-use order", () => {
    const svg = scene(tree());
    expect(svg).toContain('<clipPath id="c1">');
    expect(svg).toContain('<linearGradient id="g1" x2="1">');
    expect(svg.match(/<linearGradient/g)).toHaveLength(1);
    expect(svg).toContain('clip-path="url(#c1)"');
    expect(svg.match(/fill="url\(#g1\)"/g)).toHaveLength(2);
  });

  test("ids are deterministic across renders", () => {
    expect(scene(tree())).toBe(scene(tree()));
  });

  test("filters default to a region covering the canvas", () => {
    const glow = def.filter({}, <feGaussianBlur stdDeviation={2} />);
    expect(scene(<path d="M5 0V10" filter={glow} />)).toContain('<filter id="f1" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">');
  });
});

describe("effects", () => {
  test("wiggle is byte-deterministic per seed", () => {
    const shaky = (seed: string) => scene(<rect width={10} height={10} animation={wiggle({ x: 2, rotate: 3 }, { seed, ease: ease.hold })} />);
    expect(shaky("a")).toBe(shaky("a"));
    expect(shaky("a")).not.toBe(shaky("b"));
  });

  test("a filter primitive channel compiles to SMIL, with a still twin for reduced motion", () => {
    const boil = def.filter(
      {},
      <feTurbulence baseFrequency={0.04} animation={motion({ seed: 1 }).to({ seed: 5 }, 0.4, ease.steps(4)).loop(0.4)} />,
    );
    const svg = scene(<rect width={10} height={10} filter={boil} />);
    expect(svg).toContain('<animate attributeName="seed" values="1;2;3;4;5" keyTimes="0;0.25;0.5;0.75;1" calcMode="discrete" dur="0.4s" repeatCount="indefinite"/>');
    expect(svg).toContain('<filter id="f1s"');
    expect(svg).toContain('[filter="url(#f1)"]{filter:url(#f1s)}');
  });

  test("blur compiles to a generated filter whose stdDeviation animates with SMIL", () => {
    const svg = scene(<rect width={10} height={10} animation={enter({ at: 1, over: 1 }, { blur: 4 })} />);
    expect(svg).toMatch(/<feGaussianBlur stdDeviation="0">\s*<animate attributeName="stdDeviation" values="4;4;0;0" keyTimes="0;0.1;0.2;1" calcMode="spline"/);
    expect(body(svg)).toContain('<rect width="10" height="10" filter="url(#f1)"/>');
  });

  test("blur on an element that has its own filter lands on a wrapper", () => {
    const glow = def.filter({}, <feGaussianBlur stdDeviation={2} />);
    const svg = scene(<rect width={10} height={10} filter={glow} animation={enter({ at: 1, over: 1 }, { blur: 4 })} />);
    expect(body(svg)).toMatch(/<g filter="url\(#f2\)">\s*<rect width="10" height="10" filter="url\(#f1\)"\/>/);
  });
});
