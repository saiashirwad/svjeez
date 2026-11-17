import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { draw, ease, motion, render, span, wiggle, type Child } from "svjeez";
import { checkScene, renderFrames, type CheckRule, type Finding } from "svjeez/frames";
import { jsx } from "svjeez/jsx-runtime";
import { startTrace, stopTrace } from "../src/traced";

const browser = await renderFrames(
  render({ width: 4, height: 4, duration: 1, title: "Probe" }, <rect width={4} height={4} />),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping check tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

const scene = (content: Child, duration = 2) =>
  render({ width: 200, height: 100, duration, title: "Check" }, content);

const findings = async (svg: string, rule: CheckRule): Promise<Finding[]> =>
  (await checkScene(svg, { colorScheme: "light" })).findings.filter((found) => found.rule === rule);

const BG = <rect width={200} height={100} fill="#111" />;

describe.if(browser)("checkScene", () => {
  test("off-canvas: an error for a part the canvas never shows, nothing for one that slides in", async () => {
    const lost = await findings(
      scene(
        <>
          {BG}
          <rect x={400} y={20} width={20} height={20} fill="#fff" />
        </>,
      ),
      "off-canvas",
    );

    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ severity: "error", element: "<rect>" });

    const entering = await findings(
      scene(
        <>
          {BG}
          <rect
            x={20}
            y={20}
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ x: -300 }).to({ x: 0 }, span(0.5, 1))}
          />
        </>,
      ),
      "off-canvas",
    );

    expect(entering).toEqual([]);
  });

  test("off-canvas: a warning for a small part cut by the edge, nothing for a background that bleeds", async () => {
    const cut = await findings(
      scene(
        <>
          <rect x={-40} y={-40} width={300} height={200} fill="#111" />
          <rect x={165} y={20} width={40} height={40} fill="#fff" />
        </>,
      ),
      "off-canvas",
    );

    expect(cut).toHaveLength(1);
    expect(cut[0]).toMatchObject({ severity: "warning", element: "<rect>" });
    expect(cut[0]!.message).toContain("past the right edge");
  });

  test("text-overflow: text past the canvas or past the box it sits on, nothing for text that fits", async () => {
    const past = await findings(
      scene(
        <>
          {BG}
          <text x={150} y={20} fontSize={14} fill="#fff">
            far too long for this
          </text>
          <rect x={10} y={50} width={60} height={30} fill="#333" />
          <text x={15} y={70} fontSize={14} fill="#fff">
            overflowing label
          </text>
          <rect x={110} y={50} width={80} height={30} fill="#333" />
          <text x={120} y={70} fontSize={12} fill="#fff">
            fits
          </text>
        </>,
      ),
      "text-overflow",
    );

    expect(past.map((found) => found.element).sort()).toEqual([
      '<text "far too long for this">',
      '<text "overflowing label">',
    ]);
    expect(past.find((found) => found.element.includes("label"))!.message).toContain("<rect>");
  });

  test("static: an animation on nothing, nothing for one that moves what you see", async () => {
    const empty = await findings(
      scene(
        <>
          {BG}
          <g animation={motion({ x: 0 }).to({ x: 40 }, span(0, 1))} />
          <rect
            x={50}
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ x: 0 }).to({ x: 40 }, span(0, 1))}
          />
        </>,
      ),
      "static",
    );

    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ severity: "warning", element: "<g>" });
    expect(empty[0]!.message).toContain("draws nothing");
  });

  test("static: CSS keyframes whose values never change", async () => {
    // svjeez compiles a motion whose values never change to a plain visibility hold, so write the file by hand.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><style>@keyframes s{0%,100%{opacity:.5}}@keyframes m{0%{opacity:1}100%{opacity:.2}}.s{animation:s 2s infinite}.m{animation:m 2s infinite}</style><rect class="s" width="20" height="20"/><rect class="m" x="40" width="20" height="20"/></svg>`;
    const still = await findings(svg, "static");

    expect(still).toHaveLength(1);
    expect(still[0]!.message).toContain("none of its animated values change");
  });

  test("visible-at-zero: shown at 0 and cut to hidden as its entrance starts, nothing for one that starts hidden", async () => {
    const flash = await findings(
      scene(
        <>
          {BG}
          <rect
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ opacity: 1 })
              .set({ opacity: 0 }, 1)
              .to({ opacity: 1 }, span(1, 0.5))}
          />
          <rect
            x={50}
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ opacity: 0 }).to({ opacity: 1 }, span(1, 0.5))}
          />
          <rect
            x={100}
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ opacity: 1 })
              .set({ opacity: 0 }, 0.4)
              .to({ opacity: 1 }, span(1, 0.5))}
          />
        </>,
      ),
      "visible-at-zero",
    );

    expect(flash).toHaveLength(1);
    expect(flash[0]).toMatchObject({ severity: "error", times: [0] });
  });

  test("visible-at-zero: a fill showing at 0 while its stroke draws in later, nothing without a fill", async () => {
    const path = (fill: string, x: number) =>
      `<path class="d" d="M${x} 10H${x + 60}V60H${x}Z" fill="${fill}" stroke="#08f" pathLength="1" stroke-dasharray="1 2"/>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><style>@keyframes d{0%,25%{stroke-dashoffset:1}75%,100%{stroke-dashoffset:0}}.d{animation:d 2s infinite both}</style>${path("#f80", 10)}${path("none", 110)}</svg>`;
    const fill = await findings(svg, "visible-at-zero");

    expect(fill).toHaveLength(1);
    expect(fill[0]!.message).toContain("fill showing at 0s");
  });

  test("loop-seam: a part that jumps when the loop restarts, nothing for one that rewinds", async () => {
    const jump = await findings(
      scene(
        <>
          {BG}
          <rect
            y={10}
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ x: 0 }).to({ x: 60 }, span(0, 1))}
          />
          <rect
            y={60}
            width={20}
            height={20}
            fill="#fff"
            animation={motion({ x: 0 }).to({ x: 60 }, span(0, 1)).rewind(0.5)}
          />
        </>,
      ),
      "loop-seam",
    );

    expect(jump).toHaveLength(1);
    expect(jump[0]!.message).toContain("moves 60");
  });

  test("loop-seam: a blink that repeats a whole number of times in the loop is not a seam", async () => {
    const blink = (drawn: Child) =>
      scene(
        <>
          {BG}
          {drawn}
          {/* The loop is as long as its longest motion: this one makes it 12s. */}
          <rect
            x={150}
            width={5}
            height={5}
            fill="#fff"
            animation={motion({ x: 0 }).to({ x: 1 }, span(0, 6)).rewind(6)}
          />
        </>,
        12,
      );

    // The stars of examples/horizon: a held twinkle that cycles twice in the loop. Its restart is one more of its steps.
    const stars = Array.from({ length: 12 }, (_, i) =>
      wiggle({ opacity: 0.7 }, { seed: `star-${i}`, rate: 3, ease: ease.hold, period: 6 }),
    );

    for (const star of stars)
      expect(
        await findings(
          blink(<rect y={10} width={20} height={20} fill="#fff" animation={star} />),
          "loop-seam",
        ),
      ).toHaveLength(0);
    // A step that happens once in the loop is not periodic: dim to 0.5 at 6s, then back to full at the restart.
    const once = motion({ opacity: 1 }).to({ opacity: 0.5 }, span(6, 0.1), ease.hold);

    expect(
      await findings(
        blink(<rect y={10} width={20} height={20} fill="#fff" animation={once} />),
        "loop-seam",
      ),
    ).toHaveLength(1);
  });

  test("overlap: two texts on top of each other, nothing for a shadow copy or texts apart", async () => {
    const both = await findings(
      scene(
        <>
          {BG}
          <text x={20} y={30} fontSize={16} fill="#fff">
            first
          </text>
          <text x={24} y={32} fontSize={16} fill="#fff">
            second
          </text>
          <text x={20} y={80} fontSize={16} fill="#000">
            shadow
          </text>
          <text x={21} y={81} fontSize={16} fill="#fff">
            shadow
          </text>
          <text x={120} y={80} fontSize={16} fill="#fff">
            apart
          </text>
        </>,
      ),
      "overlap",
    );

    expect(both).toHaveLength(1);
    expect(both[0]!.message).toContain('<text "first"> and <text "second">');
  });

  test("a clean scene has nothing to report, and the default times run from 0 to just before the end", async () => {
    const report = await checkScene(
      scene(
        <>
          {BG}
          <path
            d="M20 80L180 80"
            stroke="#fff"
            strokeWidth={4}
            animation={draw({ at: 0.2, over: 1 })}
          />
        </>,
      ),
    );

    expect(report.findings).toEqual([]);
    expect(report.times[0]).toBe(0);
    expect(report.times.at(-1)!).toBeLessThan(2);
    expect(report.times.at(-1)!).toBeGreaterThan(1.9);
  });

  test("findings carry the source of a scene rendered with sources", async () => {
    const svg = render(
      { width: 100, height: 60, duration: 1, title: "Sources", sources: true },
      jsx("circle", { cx: 300, cy: 30, r: 6, fill: "#fff" }),
    );

    // Without the development runtime there is no source to carry.
    expect((await checkScene(svg)).findings[0]?.source).toBeUndefined();
  });

  test("svjeez check prints file:line:column findings and exits 1 on an error", () => {
    const result = Bun.spawnSync([
      process.execPath,
      join(import.meta.dir, "../src/cli.ts"),
      "check",
      join(import.meta.dir, "fixtures/check/offscreen.tsx"),
    ]);

    const out = result.stdout.toString();
    expect(result.exitCode).toBe(1);
    expect(out).toMatch(
      /offscreen\.tsx:9:7 {2}off-canvas {2}error: <circle> is outside the 100x60 canvas/,
    );
    expect(out).toContain("1 error, 0 warnings");
  });
});

test("checkScene rejects bad times before it starts a browser", async () => {
  await expect(checkScene(scene(BG), { times: [-1] })).rejects.toThrow(
    "checkScene() needs finite, non-negative times, got -1.",
  );
  await expect(checkScene(scene(BG), { times: [] })).rejects.toThrow(
    "checkScene() needs at least one time, got an empty list.",
  );
});

test("a trace reads each element's place off the stack, and render() writes it without sources", () => {
  startTrace(import.meta.dir);

  try {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "Trace" },
      <rect width={4} height={4} />,
    );

    expect(svg).toMatch(
      new RegExp(
        `data-source="${import.meta.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/check\\.test\\.tsx:\\d+:\\d+"`,
      ),
    );
  } finally {
    stopTrace();
  }

  expect(
    render({ width: 10, height: 10, duration: 1, title: "Trace" }, <rect width={4} height={4} />),
  ).not.toContain("data-source");
});
