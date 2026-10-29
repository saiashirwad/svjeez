import { describe, expect, test } from "bun:test";
import {
  css,
  def,
  draw,
  ease,
  el,
  enter,
  exit,
  motion,
  render,
  sample,
  wiggle,
  type Child,
} from "svjeez";

const scene = (content: Child, duration = 10) =>
  render({ width: 100, height: 100, duration, title: "Test" }, content);

const body = (svg: string) => svg.slice(svg.indexOf("</style>"));

const keyframes = (svg: string) =>
  [...svg.matchAll(/@keyframes ([\w-]+)\{(.*)\}$/gm)].map((match) => match[2]!);

describe("motion timing", () => {
  test("an ease shapes the transition it is passed to, so CSS gets it on that transition's start key", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion().at(1).to({ opacity: 0 }, 1, ease.inOut).at(5).to({ opacity: 1 }, 1)}
      />,
    );

    expect(svg).toContain("10%{opacity:1;animation-timing-function:cubic-bezier(.77,0,.175,1)}");
    expect(svg).not.toMatch(/20%[^{]*\{opacity:0;animation-timing-function/);
  });

  test("values hold between transitions without hand-written holds", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1)}
      />,
    );

    expect(keyframes(svg)).toEqual(["0%,20%{opacity:0}30%,100%{opacity:1}"]);
  });

  test("a cut right after a transition that ends the scene lands on 100%", () => {
    const svg = scene(
      <rect width={10} height={10} animation={motion({ x: 0 }).to({ x: 50 }, 10).set({ x: 0 })} />,
    );

    expect(keyframes(svg)).toEqual([
      "0%,100%{translate:0px 0px}99.999%{translate:50px 0px;animation-timing-function:steps(1)}",
    ]);
  });

  test("a loop period snaps to divide the scene", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 1 }).at(0.55).set({ opacity: 0 }).loop(1.1)}
      />,
    );

    expect(svg).toContain("animation-duration:1.111s");
    expect(keyframes(svg)).toEqual(["0%{visibility:visible}50%,100%{visibility:hidden}"]);
  });

  test("a step 0/1 opacity is a visibility toggle, so the browser skips painting it", () => {
    const svg = scene(
      <rect width={10} height={10} animation={motion({ opacity: 0 }).at(2).set({ opacity: 1 })} />,
    );

    expect(keyframes(svg)[0]).toContain("visibility:hidden");
    expect(keyframes(svg)[0]).toContain("visibility:visible");
    expect(svg).not.toContain("opacity:0");
  });

  test("a cut inside a cut cannot show through its hidden parent", () => {
    const cut = (at: number) => motion({ opacity: 0 }).at(at).set({ opacity: 1 });

    const nested = scene(
      <g animation={cut(5)}>
        <rect width={10} height={10} animation={cut(1)} />
        <path d="M0 0h10" stroke="#000" animation={draw({ at: 1, over: 1 })} />
      </g>,
    );

    const stacked = scene(<rect width={10} height={10} animation={[cut(5), cut(1)]} />);

    for (const svg of [nested, stacked])
      expect(keyframes(svg).filter((frames) => frames.includes("visibility:visible"))).toHaveLength(
        1,
      );
  });

  test("a fade, a stepped fade, or a static opacity keeps animating opacity", () => {
    const fade = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1)}
      />,
    );

    const stepped = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1, ease.steps(4))}
      />,
    );

    const pinned = scene(
      <rect
        width={10}
        height={10}
        opacity={0.5}
        animation={motion({ opacity: 0 }).at(2).set({ opacity: 1 })}
      />,
    );

    expect(keyframes(fade)[0]).toContain("opacity:");
    expect(keyframes(stepped)[0]).toContain("opacity:");
    expect(keyframes(pinned)[0]).toContain("opacity:");
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
    expect(keyframes(svg)).toEqual([
      "0%{stroke-dashoffset:1;visibility:hidden}10%,100%{stroke-dashoffset:0;visibility:visible}",
    ]);
  });

  test("draw refuses an author value that would break it", () => {
    expect(() =>
      scene(<path d="M0 0H10" pathLength={2} animation={draw({ at: 0, over: 1 })} />),
    ).toThrow(/pathLength/);
  });
});

describe("stacking", () => {
  test("motions on disjoint lanes share the element", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={[enter({ at: 0, over: 1 }), motion().at(2).to({ scale: 2 }, 1)]}
      />,
    );

    expect(body(svg)).not.toContain("<g");
  });

  test("motions on the same lane get exactly one wrapper", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={[enter({ at: 0, over: 1 }), exit({ at: 8, over: 1 })]}
      />,
    );

    expect(body(svg).match(/<g /g)).toHaveLength(1);
    expect(body(svg)).toMatch(/<g class="a m\d+">\s*<rect [^>]*class="a m\d+"\/>\s*<\/g>/);
  });

  test("two motions on one replace lane are an error", () => {
    const fill = (at: number) => motion().at(at).to({ fill: "#fff" }, 1);
    expect(() =>
      scene(<rect width={10} height={10} fill="#000" animation={[fill(1), fill(5)]} />),
    ).toThrow(/fill/);
  });

  test("scale on text pivots on a wrapper, since WebKit ignores fill-box on <text>", () => {
    const svg = scene(<text animation={motion().to({ scale: 2 }, 1)}>hi</text>);
    expect(body(svg)).toMatch(/<g class="a m1 fb">\s*<text>hi<\/text>/);
  });

  test("scale on an element with a transform attribute wraps instead of re-pivoting it", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        transform="rotate(45)"
        animation={motion().to({ scale: 2 }, 1)}
      />,
    );

    expect(body(svg)).toMatch(
      /<g class="a m1 fb">\s*<rect width="10" height="10" transform="rotate\(45\)"\/>/,
    );
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
    expect(scene(<path d="M5 0V10" filter={glow} />)).toContain(
      '<filter id="f1" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">',
    );
  });
});

describe("effects", () => {
  test("wiggle is byte-deterministic per seed", () => {
    const shaky = (seed: string) =>
      scene(
        <rect
          width={10}
          height={10}
          animation={wiggle({ x: 2, rotate: 3 }, { seed, ease: ease.hold })}
        />,
      );

    expect(shaky("a")).toBe(shaky("a"));
    expect(shaky("a")).not.toBe(shaky("b"));
  });

  test("a wiggle whose rate divides its period unevenly still renders", () => {
    expect(() =>
      scene(<rect width={10} height={10} animation={wiggle({ x: 3 }, { seed: 1, rate: 12 })} />),
    ).not.toThrow();
  });

  test("a filter primitive channel compiles to SMIL, with a still twin for reduced motion", () => {
    const boil = def.filter(
      {},
      <feTurbulence
        baseFrequency={0.04}
        animation={motion({ seed: 1 }).to({ seed: 5 }, 0.4, ease.steps(4)).loop(0.4)}
      />,
    );

    const svg = scene(<rect width={10} height={10} filter={boil} />);
    expect(svg).toContain(
      '<animate attributeName="seed" values="1;2;3;4;5" keyTimes="0;0.25;0.5;0.75;1" calcMode="discrete" dur="0.4s" repeatCount="indefinite"/>',
    );
    expect(svg).toContain('<filter id="f1s"');
    expect(svg).toContain('[filter="url(#f1)"]{filter:url(#f1s)}');
  });

  test("displace animates feDisplacementMap's scale attribute, starting from the attribute's value", () => {
    const warp = def.filter(
      {},
      <feDisplacementMap
        in="SourceGraphic"
        scale={3}
        animation={motion().at(1).to({ displace: 9 }, 1, ease.linear)}
      />,
    );

    const svg = scene(<rect width={10} height={10} filter={warp} />);
    expect(svg).toContain('<animate attributeName="scale" values="3;3;9;9" keyTimes="0;0.1;0.2;1"');
  });

  test("blur compiles to a generated filter whose stdDeviation animates with SMIL", () => {
    const svg = scene(
      <rect width={10} height={10} animation={enter({ at: 1, over: 1 }, { blur: 4 })} />,
    );

    expect(svg).toMatch(
      /<feGaussianBlur stdDeviation="0">\s*<animate attributeName="stdDeviation" values="4;4;0;0" keyTimes="0;0.1;0.2;1" calcMode="spline"/,
    );
    expect(body(svg)).toContain('<rect width="10" height="10" filter="url(#f1)"/>');
  });

  test("the reduced-motion still of a blur is the blur sample() reads at that moment, mid-transition included", () => {
    for (const curve of [ease.linear, ease.out, ease.pop, ease.steps(4)]) {
      const blur = motion({ blur: 0 }).at(1).to({ blur: 4 }, 3, curve);

      const svg = render(
        { width: 100, height: 100, duration: 6, title: "Still", reducedMotion: { at: 3 } },
        <rect width={10} height={10} animation={blur} />,
      );

      const still = svg.match(/<filter id="f1s"[^>]*>\s*<feGaussianBlur stdDeviation="([^"]+)"/);
      expect(Number(still?.[1])).toBeCloseTo(sample(blur, 3, { duration: 6 }).blur, 2);
      expect(Number(still?.[1])).toBeGreaterThan(0);
    }
  });

  test("blur on an element that has its own filter lands on a wrapper", () => {
    const glow = def.filter({}, <feGaussianBlur stdDeviation={2} />);

    const svg = scene(
      <rect
        width={10}
        height={10}
        filter={glow}
        animation={enter({ at: 1, over: 1 }, { blur: 4 })}
      />,
    );

    expect(body(svg)).toMatch(
      /<g filter="url\(#f2\)">\s*<rect width="10" height="10" filter="url\(#f1\)"\/>/,
    );
  });
});

describe("el", () => {
  test("renders exactly what the equivalent JSX renders", () => {
    const viaJsx = scene(
      <g opacity={0.5}>
        <rect x={12} y={34} width={10} height={10} animation={enter({ at: 1, over: 0.5 })} />
        <text x={4} y={10} fontSize={8}>
          {"  hi  "}
        </text>
      </g>,
    );

    const viaEl = scene(
      el.g({ opacity: 0.5 }, [
        el.rect({ x: 12, y: 34, width: 10, height: 10, animation: enter({ at: 1, over: 0.5 }) }),
        el.text({ x: 4, y: 10, fontSize: 8 }, "  hi  "),
      ]),
    );

    expect(viaEl).toBe(viaJsx);
  });

  test("destructures and takes no arguments", () => {
    const { circle } = el;
    expect(scene(circle())).toBe(scene(<circle />));
  });
});

describe("properties", () => {
  const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
  const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
  const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });
  const spin = () => motion().to({ [yaw]: 90 }, 1, ease.linear);

  test("an animated property is registered once and keyframed under its render name", () => {
    const svg = scene(
      <>
        <g animation={spin()} />
        <g animation={spin()} />
      </>,
    );

    expect(svg).toContain("@property --p1{syntax:'<angle>';inherits:true;initial-value:0deg}");
    expect(svg.match(/@property/g)).toHaveLength(1);
    expect(keyframes(svg)).toEqual(["0%{--p1:0deg}10%,100%{--p1:90deg}"]);
    expect(body(svg).match(/<g class="a m1"\/>/g)).toHaveLength(2);
  });

  test("style sets properties per element, with units from the syntax", () => {
    const svg = scene(
      <circle r={2} style={{ [px]: 0.25, [yaw]: 30, [tint]: "#f80", opacity: 0.5 }} />,
    );

    expect(body(svg)).toContain('style="--p1:0.25;--p2:30deg;--p3:#f80;opacity:0.5"');
    expect(svg).toContain("@property --p3{syntax:'<color>';inherits:false;initial-value:#000}");
  });

  test("a declared property that nothing uses is not registered", () => {
    expect(scene(<rect width={1} height={1} style={{ opacity: 0.5 }} />)).not.toContain(
      "@property",
    );
  });

  test("css holes read a property by its render name, and register it", () => {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "T", css: css`.d{rotate:calc(${yaw} * ${2})}` },
      <g animation={spin()} />,
    );

    expect(svg).toContain(".d{rotate:calc(var(--p1) * 2)}");
    expect(svg.match(/@property --p1\{/g)).toHaveLength(1);
  });

  test("names follow first use in the render, not declaration order", () => {
    const svg = scene(<circle r={2} style={{ [tint]: "#fff", [px]: 1 }} />);
    expect(body(svg)).toContain('style="--p1:#fff;--p2:1"');
  });

  test("declaring a property again returns the same key, and declaring it differently throws", () => {
    expect(def.property("yaw", { syntax: "angle", inherits: true, initial: 0 })).toBe(yaw);
    expect(() => def.property("yaw", { syntax: "angle", inherits: false, initial: 0 })).toThrow(
      /already declared/,
    );
  });

  test("an undeclared property key is refused when the motion is built", () => {
    // SAFETY: the key is deliberately undeclared, so the cast lets it reach motion(), which must refuse it at runtime.
    expect(() => motion().to({ ["--nope:angle" as typeof yaw]: 1 }, 1)).toThrow(/never declared/);
  });

  test("a property lives on its element: two motions on it are an error, and filter primitives cannot take one", () => {
    expect(() =>
      scene(
        <g
          animation={[
            spin(),
            motion()
              .at(5)
              .to({ [yaw]: 0 }, 1),
          ]}
        />,
      ),
    ).toThrow(/--yaw:angle/);
    // SAFETY: a filter primitive cannot take a motion, which is the error under test, so the cast gets past its prop type.
    const flood = def.filter({}, <feFlood animation={motion().to({ [yaw]: 1 }, 1) as never} />);
    expect(() => scene(<rect width={1} height={1} filter={flood} />)).toThrow(
      /cannot animate --yaw:angle/,
    );
  });
});

describe("output", () => {
  const wellFormed = (svg: string) =>
    Bun.spawnSync(["xmllint", "--noout", "-"], { stdin: Buffer.from(svg) }).exitCode === 0;

  test.skipIf(!Bun.which("xmllint"))(
    "style text that is not XML-safe still makes a well-formed file",
    () => {
      const css = `@property --x{syntax:'<angle>';inherits:true;initial-value:0deg}\n.q::after{content:"]]>"}`;
      expect(
        wellFormed(
          render(
            { width: 10, height: 10, duration: 1, title: "T", css },
            <rect width={1} height={1} />,
          ),
        ),
      ).toBe(true);
    },
  );
});

describe("timeline", () => {
  test("a move that starts just after the previous one ends still renders", () => {
    const track = motion({ opacity: 0 })
      .to({ opacity: 1 }, 0.333333)
      .at(1 / 3)
      .to({ opacity: 0 }, 0.5);

    expect(() => scene(<rect animation={track} />, 2)).not.toThrow();
  });
});

describe("loop", () => {
  const scene = (loop?: boolean) =>
    render(
      { width: 100, height: 100, duration: 6, title: "Loop", loop },
      <>
        <rect
          width={10}
          height={10}
          animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1)}
        />
        <circle r={4} animation={motion({ rotate: 0 }).to({ rotate: 90 }, 1).loop(2)} />
        <path d="M0 0H10" stroke="#fff" animation={motion({ blur: 0 }).at(2).to({ blur: 4 }, 1)} />
      </>,
    );

  test("scenes loop by default", () => {
    const svg = scene();
    expect(svg).toBe(scene(true));
    expect(svg).toContain("animation-iteration-count:infinite");
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).not.toContain('fill="freeze"');
  });

  test("loop: false plays once, repeating shorter loops to fill the scene, and holds the end", () => {
    const svg = scene(false);
    expect(svg).toContain("animation-iteration-count:1;animation-fill-mode:both");
    expect(svg).toContain("animation-duration:2s;animation-iteration-count:3");
    expect(svg).toContain('repeatCount="1" fill="freeze"');
    expect(svg).not.toContain("infinite");
    expect(svg).not.toContain("indefinite");
  });
});

describe("playbackRate", () => {
  const durations = (svg: string) =>
    [...svg.matchAll(/(?:animation-duration:|animation-delay:-|dur=")([\d.,s]+)/g)].flatMap((m) =>
      m[1]!.split(",").map(parseFloat),
    );

  test("playbackRate divides every emitted duration and keeps the timeline", () => {
    const scene = (playbackRate: number) =>
      render(
        {
          width: 100,
          height: 100,
          duration: 6,
          title: "Speed",
          playbackRate,
          reducedMotion: { at: 3 },
        },
        <>
          <rect
            width={10}
            height={10}
            animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1)}
          />
          <circle r={4} animation={motion({ rotate: 0 }).to({ rotate: 90 }, 1).loop(4)} />
          <path
            d="M0 0H10"
            stroke="#fff"
            animation={motion({ blur: 0 }).at(2).to({ blur: 4 }, 1)}
          />
        </>,
      );

    const [normal, fast] = [scene(1), scene(2)];
    expect(durations(normal).sort()).toEqual([3, 3, 6, 6]);
    expect(durations(fast)).toEqual(durations(normal).map((d) => d / 2));
    expect(fast.replace(/(?:animation-duration:|animation-delay:-|dur=")[\d.,s]+/g, "")).toBe(
      normal.replace(/(?:animation-duration:|animation-delay:-|dur=")[\d.,s]+/g, ""),
    );
  });

  test("playbackRate must be positive", () => {
    expect(() =>
      render({ width: 10, height: 10, duration: 1, title: "x", playbackRate: 0 }, null),
    ).toThrow(/playbackRate/);
  });
});
