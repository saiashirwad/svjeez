import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewrite, run } from "./codemod-0.7.ts";

const before = `import { Camera, Steady, flow, Pivot, sample, sampledPath, render, type Values, type SampleOptions } from "svjeez";
import { flowchart, type Diagram } from "svjeez/extras";
import { axes, fieldFlow, type Line } from "svjeez/extras";
import { tomorrowNight, timeline, readout } from "svjeez/extras";
import { fit, number, type Schema } from "svjeez/params";
import { renderVideo } from "@svjeez/video";
import type { Icon } from "@svjeez/icons";

const values: Values<"x"> = { x: 1 };
const options: SampleOptions = { duration: 2 };
const now = sample(slide, 1, options);
const wave = sampledPath((t) => "M" + t, { duration: 4, tolerance: 0.5 });
const dot: Line | undefined = undefined;
const icon: Icon = rocket;
const clip = await renderVideo(svg, { fps: 30 });
// sample( in a comment and "Steady" in a string stay as they are
const note = "Steady sample(Values)";

export default () => (
  <g>
    <Camera frame={frame} stops={stops}>
      <Steady frame={frame} stops={stops} at={{ x: 1, y: 2 }}>
        <circle r={4} />
      </Steady>
    </Camera>
    <Pivot at={{ x: 5, y: 5 }} animation={spin} />
    {flow(points, { at: 1, loop: 4, style: "comet" }).node}
    {fieldFlow(lines, { at: 3.5, speed: 110 })}
  </g>
);
`;

const after = `import { Camera, flow, Pivot, valuesAt, sampled, render, type ChannelValues, type ValuesAtOptions } from "svjeez";
import { flowchart, type Diagram } from "@svjeez/diagrams";
import { axes, type CalculusLine } from "@svjeez/math";
import { tomorrowNight } from "@svjeez/code";
import { timeline, readout } from "svjeez";
import { fit } from "@svjeez/live";
import { number, type Schema } from "svjeez/params";
import { video } from "@svjeez/video";
import type { IconData } from "@svjeez/icons";

const values: ChannelValues<"x"> = { x: 1 };
const options: ValuesAtOptions = { duration: 2 };
const now = valuesAt(slide, 1, options);
const wave = sampled.path((t) => "M" + t, { over: 4, tolerance: 0.5 });
const dot: CalculusLine | undefined = undefined;
const icon: IconData = rocket;
const clip = await video(svg, { fps: 30 });
// sample( in a comment and "Steady" in a string stay as they are
const note = "Steady sample(Values)";

export default () => (
  <g>
    <Camera frame={frame} stops={stops}>
      <Camera steady frame={frame} stops={stops} origin={{ x: 1, y: 2 }}>
        <circle r={4} />
      </Camera>
    </Camera>
    <Pivot origin={{ x: 5, y: 5 }} animation={spin} />
    {flow(points, { at: 1, period: 4, style: "comet" }).node}
    {flow(lines, { at: 3.5, speed: 110 }).node}
  </g>
);
`;

test("a project written for 0.6 is rewritten for 0.7", () => {
  const { text, warnings } = rewrite("scene.tsx", before);

  expect(text).toBe(after);
  expect(warnings).toEqual([]);
});

test("running it again changes nothing", () => {
  expect(rewrite("scene.tsx", after).text).toBe(after);
});

test("a renamed import whose new name is already in use keeps its old name in the file", () => {
  const source =
    'import { renderVideo } from "@svjeez/video";\nconst video = 1;\nrenderVideo(video);\n';

  expect(rewrite("a.ts", source).text).toBe(
    'import { video as renderVideo } from "@svjeez/video";\nconst video = 1;\nrenderVideo(video);\n',
  );
});

test("what it cannot rewrite is a warning, and the file is otherwise left alone", () => {
  const source = [
    'import * as extras from "svjeez/extras";',
    'import { voxel } from "svjeez/voxel";',
    "voxel.scene({ camera, blocks });",
    "",
  ].join("\n");

  const { warnings } = rewrite("a.ts", source);
  expect(warnings.length).toBe(2);
  expect(warnings.join("\n")).toContain("a.ts:1:");
  expect(warnings.join("\n")).toContain("Voxels were removed");
});

test("a folder is rewritten in place, and --dry only reports", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-codemod-"));

  try {
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "src", "scene.tsx"), before);
    writeFileSync(join(dir, "node_modules", "skip.ts"), before);
    writeFileSync(join(dir, "src", "notes.md"), before);

    const dry = run([dir], true);
    expect(dry.changed).toEqual([join(dir, "src", "scene.tsx")]);
    expect(readFileSync(join(dir, "src", "scene.tsx"), "utf8")).toBe(before);

    run([dir]);
    expect(readFileSync(join(dir, "src", "scene.tsx"), "utf8")).toBe(after);
    expect(readFileSync(join(dir, "node_modules", "skip.ts"), "utf8")).toBe(before);
    expect(readFileSync(join(dir, "src", "notes.md"), "utf8")).toBe(before);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

const timeBefore = `import { cut, during, flow, sampled, terminal, timeline, typewriter, visible } from "svjeez";
import { globe, nightfall } from "@svjeez/geo";

const tl = timeline({ intro: 3, body: 5 });
const session = terminal([{ cmd: "ls" }], { at: 1 });
const typed = typewriter(code("a"), { at: 2 });
const trip = flow(line, { at: 1, over: 2 });
const D = Math.ceil(session.end + typed.end) + trip.end;

export default () => (
  <g>
    <g animation={during(tl.body, 0.5)} />
    <g animation={during(tl.body)} />
    <g animation={cut({ at: 1, over: 2 })} />
    <g animation={visible(flashes, 0.08)} />
    <g animation={tl.show("intro")} />
    <g animation={tl.enter("body")} />
    <g animation={tl.show(scene)} />
    <g animation={sampled((t) => ({ x: t }), { duration: D, tolerance: { translate: 1 } })} />
    <g animation={sampled.path((t) => "M" + t, { duration, tolerance: 0.5 })} />
    {globe(world, { frame, spin, duration: 24 })}
    {nightfall(map, date, { duration: 20 })}
  </g>
);
`;

const timeAfter = `import { show, flow, sampled, terminal, timeline, typewriter } from "svjeez";
import { globe, nightfall } from "@svjeez/geo";

const tl = timeline({ intro: 3, body: 5 });
const session = terminal([{ cmd: "ls" }], { at: 1 });
const typed = typewriter(code("a"), { at: 2 });
const trip = flow(line, { at: 1, over: 2 });
const D = Math.ceil(session.span.end + typed.span.end) + trip.span.end;

export default () => (
  <g>
    <g animation={show(tl.body, { fade: 0.5 })} />
    <g animation={show(tl.body)} />
    <g animation={show({ at: 1, over: 2 }, { fade: 0 })} />
    <g animation={show(flashes, { fade: 0.08 })} />
    <g animation={show(tl.intro)} />
    <g animation={show({ at: tl.body.at })} />
    <g animation={show(tl[scene])} />
    <g animation={sampled((t) => ({ x: t }), { over: D, tolerance: { translate: 1 } })} />
    <g animation={sampled.path((t) => "M" + t, { over: duration, tolerance: 0.5 })} />
    {globe(world, { frame, spin, over: 24 })}
    {nightfall(map, date, { over: 20 })}
  </g>
);
`;

test("the time model's moves are rewritten: show, over, and the span of a result", () => {
  const { text, warnings } = rewrite("time.tsx", timeBefore);

  expect(text).toBe(timeAfter);
  expect(warnings).toEqual([
    "time.tsx:15: visible() faded outside its spans and show() fades inside them, so check the timing.",
  ]);
  expect(rewrite("time.tsx", timeAfter).text).toBe(timeAfter);
});

test("a timeline's show and enter get the show import when nothing else brought it", () => {
  const source =
    'import { timeline } from "svjeez";\nconst tl = timeline({ a: 1 });\nconst fade = tl.show("a");\n';

  expect(rewrite("a.ts", source).text).toBe(
    'import { timeline } from "svjeez";\nimport { show } from "svjeez";\nconst tl = timeline({ a: 1 });\nconst fade = show(tl.a);\n',
  );
});
