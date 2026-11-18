import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkScene, renderFrames, type CheckRule, type Finding } from "svjeez/frames";
import {
  Group,
  Shape,
  Text,
  draw,
  ease,
  font,
  motion,
  path,
  rect,
  circle,
  scene,
  span,
  track,
  wiggle,
  type SceneElement,
} from "svjeez";
import { svg, type Hex } from "svjeez/tools";
import { startTrace, stopTrace } from "../src/svg/traced";

const made = (build: () => SceneElement, duration = 2, sources = false): string =>
  svg.emit(scene({ size: [200, 100], duration, title: "Check" }, build), { sources });

const browser = await renderFrames(
  svg.emit(
    scene({ size: [4, 4], duration: 1, title: "Probe" }, () => (
      <Shape geometry={rect(4, 4)} fill="#000000" />
    )),
  ),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping check tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

const sans = await font.load(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url));

const findings = async (svg: string, rule: CheckRule): Promise<Finding[]> =>
  (await checkScene(svg, { colorScheme: "light" })).findings.filter((found) => found.rule === rule);

const BG = () => <Shape geometry={rect(200, 100)} fill="#111111" />;

const square = (x: number, y: number, extra: Partial<Parameters<typeof Shape>[0]> = {}) => (
  <Shape geometry={rect(20, 20)} fill="#FFFFFF" at={[x, y]} {...extra} />
);

const label = (x: number, y: number, size: number, text: string, fill: Hex = "#FFFFFF") => (
  <Text font={sans} size={size} fill={fill} at={[x, y]}>
    {text}
  </Text>
);

describe.if(browser)("checkScene", () => {
  test("samples animations inside a nested SVG on the checked scene's clock", async () => {
    const picture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" width="160" height="90" data-playback-rate="2">
      <style>
        @keyframes appear {
          0%, 39%, 60%, 100% { opacity: 0 }
          40%, 59% { opacity: 1 }
        }
        .animated { animation: appear 1s step-end infinite }
        text { font-family: sans-serif; font-size: 18px }
      </style>
      <text x="10" y="30" data-key="fixed">First label</text>
      <svg width="160" height="90">
        <text x="12" y="32" class="animated" data-key="moving">Second label</text>
      </svg>
    </svg>`;

    const report = await checkScene(picture, { times: [0, 0.5, 0.9], colorScheme: "light" });
    const overlaps = report.findings.filter(({ rule }) => rule === "overlap");

    expect(overlaps.map(({ times }) => times)).toEqual([[0.9]]);
  });

  test("off-canvas: an error for a part the canvas never shows, nothing for one that slides in", async () => {
    const lost = await findings(
      made(() => (
        <Group>
          <BG />
          {square(400, 20)}
        </Group>
      )),
      "off-canvas",
    );

    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ severity: "error", element: "<rect>" });

    const entering = await findings(
      made(() => (
        <Group>
          <BG />
          {square(20, 20, {
            motion: motion({ offset: [-300, 0] }).to({ offset: [0, 0] }, span(0.5, 1)),
          })}
        </Group>
      )),
      "off-canvas",
    );

    expect(entering).toEqual([]);
  });

  test("off-canvas: a warning for a small part cut by the edge, nothing for a background that bleeds", async () => {
    const cut = await findings(
      made(() => (
        <Group>
          <Shape geometry={rect(300, 200)} fill="#111111" at={[-40, -40]} />
          <Shape geometry={rect(40, 40)} fill="#FFFFFF" at={[165, 20]} />
        </Group>
      )),
      "off-canvas",
    );

    expect(cut).toHaveLength(1);
    expect(cut[0]).toMatchObject({ severity: "warning", element: "<rect>" });
    expect(cut[0]!.message).toContain("past the right edge");
  });

  test("text-overflow: text past the canvas or past the box it sits on, nothing for text that fits", async () => {
    const past = await findings(
      made(() => (
        <Group>
          <BG />
          {label(150, 8, 14, "far too long for this")}
          <Shape geometry={rect(90, 30)} fill="#333333" at={[10, 50]} />
          {label(15, 58, 14, "overflowing label")}
          <Shape geometry={rect(80, 30)} fill="#333333" at={[110, 50]} />
          {label(120, 58, 12, "fits")}
        </Group>
      )),
      "text-overflow",
    );

    expect(past.map((found) => found.element).sort()).toEqual([
      '<text "far too long for this">',
      '<text "overflowing label">',
    ]);
    expect(past.find((found) => found.element.includes("label"))!.message).toContain("<rect>");
  });

  test("static: CSS keyframes whose values never change", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><style>@keyframes s{0%,100%{opacity:.5}}@keyframes m{0%{opacity:1}100%{opacity:.2}}.s{animation:s 2s infinite}.m{animation:m 2s infinite}</style><rect class="s" width="20" height="20"/><rect class="m" x="40" width="20" height="20"/></svg>`;
    const still = await findings(svg, "static");

    expect(still).toHaveLength(1);
    expect(still[0]!.message).toContain("none of its animated values change");
  });

  test("static: an animation on nothing, nothing for one that moves what you see", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><style>@keyframes m{0%{translate:0px}100%{translate:40px}}.m{animation:m 2s infinite}</style><rect width="200" height="100" fill="#111"/><g class="m"/><rect class="m" x="50" width="20" height="20" fill="#fff"/></svg>`;
    const empty = await findings(svg, "static");

    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ severity: "warning", element: "<g>" });
    expect(empty[0]!.message).toContain("draws nothing");
  });

  test("visible-at-zero: shown at 0 and cut to hidden as its entrance starts, nothing for one that starts hidden", async () => {
    const flash = await findings(
      made(() => (
        <Group>
          <BG />
          {square(0, 0, { opacity: track(1).set(0, span(1)).to(1, span(1, 0.5)) })}
          {square(50, 0, { opacity: track(0).to(1, span(1, 0.5)) })}
          {square(100, 0, { opacity: track(1).set(0, span(0.4)).to(1, span(1, 0.5)) })}
        </Group>
      )),
      "visible-at-zero",
    );

    expect(flash).toHaveLength(1);
    expect(flash[0]).toMatchObject({ severity: "error", times: [0] });
  });

  test("visible-at-zero: a fill showing at 0 while its stroke draws in later, nothing without a fill", async () => {
    const outline = (x: number, fill?: Hex) => (
      <Shape
        geometry={rect(60, 50)}
        at={[x, 10]}
        {...(fill !== undefined && { fill })}
        stroke={{ color: "#0088FF" }}
        trim={draw(span(0.5, 1))}
      />
    );

    const fill = await findings(
      made(() => (
        <Group>
          {outline(10, "#FF8800")}
          {outline(110)}
        </Group>
      )),
      "visible-at-zero",
    );

    expect(fill).toHaveLength(1);
    expect(fill[0]!.message).toContain("fill showing at 0s");
  });

  test("loop-seam: a part that jumps when the loop restarts, nothing for one that rewinds", async () => {
    const jump = await findings(
      made(() => (
        <Group>
          <BG />
          {square(0, 10, {
            motion: motion({ offset: [0, 0] }).to({ offset: [60, 0] }, span(0, 1)),
          })}
          {square(0, 60, {
            motion: motion({ offset: [0, 0] })
              .to({ offset: [60, 0] }, span(0, 1))
              .rewind(0.5),
          })}
        </Group>
      )),
      "loop-seam",
    );

    expect(jump).toHaveLength(1);
    expect(jump[0]!.message).toContain("moves 60");
  });

  test("loop-seam: a blink that repeats a whole number of times in the loop is not a seam", async () => {
    const blink = (layer: ReturnType<typeof motion>) =>
      made(
        () => (
          <Group>
            <BG />
            {square(0, 10, { motion: layer })}
            <Shape
              geometry={rect(5, 5)}
              fill="#FFFFFF"
              at={[150, 0]}
              motion={motion({ offset: [0, 0] })
                .to({ offset: [1, 0] }, span(0, 6))
                .rewind(6)}
            />
          </Group>
        ),
        12,
      );

    for (let i = 0; i < 12; i++)
      expect(
        await findings(
          blink(
            wiggle({ opacity: 0.7 }, { seed: `star-${i}`, rate: 3, curve: ease.hold, period: 6 }),
          ),
          "loop-seam",
        ),
      ).toHaveLength(0);

    expect(
      await findings(
        blink(motion({ opacity: 1 }).to({ opacity: 0.5 }, span(6, 0.1), ease.hold)),
        "loop-seam",
      ),
    ).toHaveLength(1);
  });

  test("overlap: two texts on top of each other, nothing for a shadow copy or texts apart", async () => {
    const both = await findings(
      made(() => (
        <Group>
          <BG />
          {label(20, 18, 16, "first")}
          {label(24, 20, 16, "second")}
          {label(20, 68, 16, "shadow", "#000000")}
          {label(21, 69, 16, "shadow")}
          {label(120, 68, 16, "apart")}
        </Group>
      )),
      "overlap",
    );

    expect(both).toHaveLength(1);
    expect(both[0]!.message).toContain('<text "first"> and <text "second">');
  });

  test("a clean scene has nothing to report, and the default times run from 0 to just before the end", async () => {
    const report = await checkScene(
      made(() => (
        <Group>
          <BG />
          <Shape
            geometry={path().moveTo([20, 80]).lineTo([180, 80])}
            stroke={{ color: "#FFFFFF", width: 4 }}
            trim={draw(span(0.2, 1))}
          />
        </Group>
      )),
    );

    expect(report.findings).toEqual([]);
    expect(report.times[0]).toBe(0);
    expect(report.times.at(-1)!).toBeLessThan(2);
    expect(report.times.at(-1)!).toBeGreaterThan(1.9);
  });

  test("findings carry the key and source of a scene emitted with sources", async () => {
    const lost = () => (
      <Group>
        <BG />
        <Shape key="lost" geometry={circle(6)} fill="#FFFFFF" at={[300, 30]} />
      </Group>
    );

    expect((await checkScene(made(lost))).findings[0]).toMatchObject({ rule: "off-canvas" });
    expect((await checkScene(made(lost))).findings[0]?.key).toBeUndefined();

    startTrace({ within: import.meta.dir, onRender: () => {} });

    const traced = (() => {
      try {
        return made(lost, 2, true);
      } finally {
        stopTrace();
      }
    })();

    const [found] = (await checkScene(traced)).findings;
    expect(found).toMatchObject({ rule: "off-canvas", key: "lost" });
    expect(found!.source).toMatch(/check\.test\.tsx:\d+:\d+$/);
  });

  const cli = (...flags: string[]) =>
    Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), "check", ...flags]);

  test("cues pick up a short overlap between uniform samples", async () => {
    const cue = svg.emit((await import("./fixtures/check/cue-scene")).default);
    const uniform = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

    expect((await checkScene(cue, { times: uniform })).findings).toEqual([]);
    expect((await checkScene(cue, { cues: [0.3] })).findings.map((found) => found.rule)).toEqual([
      "overlap",
    ]);
  });

  test("svjeez check finds a short overlap in a scene model between its uniform samples", () => {
    const file = join(import.meta.dir, "fixtures/check/cue-scene.tsx");
    const uniform = cli(file, "--json", "--times", "0,0.5,1,1.5,2,2.5,3,3.5");

    expect(uniform.exitCode).toBe(0);
    expect(uniform.stdout.toString()).toContain('"code": "overlap"');
  });

  test("svjeez check prints file:line:column findings and exits 1 on an error", () => {
    const result = cli(join(import.meta.dir, "fixtures/check/offscreen-scene.tsx"));
    const out = result.stdout.toString();

    expect(result.exitCode).toBe(1);
    expect(out).toMatch(
      /offscreen-scene\.tsx:6:5 {2}off-canvas {2}error: <Shape> "dot" is outside the 100×60 canvas/,
    );
    expect(out).toContain("\n    hint: Move it onto the canvas, or remove it.");
    expect(out).toContain("1 error, 0 warnings");
  });

  test("svjeez check reads a scene model first, names nodes by key, and says each rule once", () => {
    const result = cli(join(import.meta.dir, "fixtures/check/model.tsx"), "--json");
    const report = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(1);
    expect(Object.keys(report)).toEqual(["errors", "warnings", "info"]);
    expect(report.errors).toEqual([
      expect.objectContaining({
        code: "off-canvas",
        key: "lost",
        source: expect.objectContaining({ line: 6 }),
        hint: "Move it onto the canvas, or remove it.",
      }),
    ]);
    expect(result.stdout.toString()).not.toMatch(/<(rect|path|circle)>/);
  });

  test("svjeez check --no-browser reads the model alone, and --at describes the picture", () => {
    const result = cli(
      join(import.meta.dir, "fixtures/check/model.tsx"),
      "--no-browser",
      "--at",
      "1",
    );

    const out = result.stdout.toString();

    expect(out).toContain("1 error, 0 warnings, 1 info; model only");
    expect(out).toContain("at 1s:");
    expect(out).toContain("dot: shown throughout; at 0s–end");
  });

  test("a scene that throws while it builds is a finding in the same shape", () => {
    const result = cli(join(import.meta.dir, "fixtures/check/broken.tsx"), "--json");
    const report = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(1);
    expect(report.errors).toEqual([
      expect.objectContaining({
        code: "compile-error",
        key: "",
        message: "width is not known yet",
        source: expect.objectContaining({ line: 4 }),
      }),
    ]);
  });
});

test("checkScene rejects bad times before it starts a browser", async () => {
  const still = made(BG);

  await expect(checkScene(still, { times: [-1] })).rejects.toThrow(
    "checkScene() needs finite, non-negative times, got -1.",
  );
  await expect(checkScene(still, { times: [] })).rejects.toThrow(
    "checkScene() needs at least one time, got an empty list.",
  );
});

test("a trace reads each node's place off the stack, and sources writes it", () => {
  const build = () => <Shape key="box" geometry={rect(4, 4)} fill="#000000" />;

  startTrace({ within: import.meta.dir, onRender: () => {} });

  try {
    const model = scene({ size: [10, 10], duration: 1, title: "Trace" }, build);

    expect(svg.emit(model, { sources: true })).toMatch(
      new RegExp(
        `data-source="${import.meta.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/check\\.test\\.tsx:\\d+:\\d+"`,
      ),
    );
    expect(svg.emit(model)).not.toContain("data-source");
  } finally {
    stopTrace();
  }

  expect(
    svg.emit(scene({ size: [10, 10], duration: 1, title: "Trace" }, build), { sources: true }),
  ).not.toContain("data-source");
});

describe("svjeez check when the scene does not build", () => {
  const cli = (...flags: string[]) =>
    Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), "check", ...flags]);

  const fixture = (name: string) => join(import.meta.dir, `fixtures/check/${name}.tsx`);

  test("a compile error carries the node's line, its name, and the fix as the hint", () => {
    const result = cli(fixture("unpainted"), "--no-browser", "--json");
    const report = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(1);
    expect(report.errors).toEqual([
      expect.objectContaining({
        code: "compile-error",
        message: "<Shape> paints nothing: it has no fill and no stroke.",
        hint: "Give it a fill, as in fill={theme.text}, or a stroke, as in stroke={{ color: theme.text }}.",
        source: expect.objectContaining({ line: 6 }),
      }),
    ]);
  });

  test("two steps on one track point at the second call", () => {
    const out = cli(fixture("overlap"), "--no-browser").stdout.toString();

    expect(out).toMatch(
      /overlap\.tsx:7:\d+ {2}compile-error {2}error: Two steps move this track at once: one from 0s to 1s, and another at 0\.5s/,
    );
  });

  test("--at says to fix the build first, not that the file is SVG", () => {
    const out = cli(fixture("unpainted"), "--no-browser", "--at", "1").stdout.toString();

    expect(out).toContain(
      "--at describes the scene once it builds; fix the compile error above first.",
    );
    expect(out).not.toContain("this file is SVG");
  });
});
