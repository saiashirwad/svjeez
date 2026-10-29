// Builds a reel for every change in this branch and, with --pr, posts them into that PR's body.
//
//   bun run reel/make.ts                     build into reel/out/ and write reel/out/reel.md
//   bun run reel/make.ts --pr 25             also upload to pr-assets/25 and update the PR body
//   bun run reel/make.ts --only hero,icons   just these shots (scene diffs are named after their file)
//
// Pages come from REEL_BEFORE (production) and REEL_AFTER (a preview of this branch, `bunx astro preview --port 4330`
// in site/). Scenes come from REEL_BASE (main) and this checkout.
import { mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { validateSvg } from "svjeez";
import {
  changes,
  close,
  crop,
  dedupe,
  film,
  region,
  resample,
  steady,
  still,
  within,
} from "./capture";
import { compare } from "./compare";
import { flipbook, wipe } from "./scenes";
import { shots } from "./shots";
import { publish } from "./publish";
import { atRef, changedScenes, here, renderAs } from "./source";

const { values } = parseArgs({
  options: { pr: { type: "string" }, only: { type: "string" } },
});

const OUT = join(import.meta.dir, "out");
const BASE = process.env.REEL_BASE ?? "main";
const BEFORE = process.env.REEL_BEFORE ?? "https://svjeez.texoport.in";
const AFTER = process.env.REEL_AFTER ?? "http://localhost:4330";
const only = values.only?.split(",");
const wants = (name: string) => !only || only.includes(name);
const VIEWPORT = { width: 1440, height: 900 };

await rm(OUT, { recursive: true, force: true });

await mkdir(OUT, { recursive: true });

export interface Reel {
  readonly file: string;
  readonly title: string;
  readonly note: string;
}

const reels: Reel[] = [];
const unchanged: string[] = [];

const write = async (name: string, title: string, note: string, svg: string) => {
  const { warnings } = validateSvg(svg);
  const file = join(OUT, `${name}.svg`);
  await Bun.write(file, svg);
  reels.push({ file, title, note: `${note} ${(svg.length / 1024).toFixed(0)} KB.` });
  console.log(
    `✓ ${name}.svg  ${(svg.length / 1024).toFixed(1)} KB${warnings.length ? `  (${warnings.join("; ")})` : ""}`,
  );
};

// Scene diffs: every scene file this branch changed, both copies live in one SVG.
for (const path of changedScenes(BASE)) {
  const name = `scene-${basename(path, ".tsx") === "index" ? basename(join(path, "..")) : basename(path, ".tsx")}`;

  if (!wants(name)) continue;
  const [before, after] = [renderAs("b", await atRef(BASE, path)), renderAs("b", await here(path))];

  if (before === after) {
    unchanged.push(`\`${path}\` (renders the same)`);
    continue;
  }

  await write(
    name,
    `\`${path}\``,
    `${BASE} on the left, this branch on the right, both rendered from source and playing in sync.`,
    compare(before, renderAs("h", await here(path)), { title: `${path}, before and after` }),
  );
}

for (const shot of shots) {
  if (!wants(shot.name)) continue;
  const [from, to] = [`${BEFORE}${shot.path}`, `${AFTER}${shot.path}`];

  if (shot.kind === "still") {
    const before = await still(from, VIEWPORT, shot.selector, shot.scheme);
    const after = await still(to, VIEWPORT, shot.selector, shot.scheme);
    const [a, b] = [before.shot, after.shot];
    const noise = [...(await changes(a, before.again)), ...(await changes(b, after.again))];
    const boxes = steady(await changes(a, b), noise);
    const area = region(boxes, VIEWPORT);

    if (noise.length) console.log(`  ${shot.name}: ignored ${noise.length} regions still moving`);

    if (!area) {
      unchanged.push(shot.title);
      continue;
    }

    // Crop both stills to the change, so the reel shows it at a readable size.
    const width = Math.min(960, area.width);

    const [ca, cb] = await crop(
      [
        { t: 0, jpeg: a },
        { t: 0, jpeg: b },
      ],
      area,
      area.width,
      0.8,
    );

    await write(
      shot.name,
      shot.title,
      `Production, then this branch, with reduced motion on. ${boxes.length} changed ${boxes.length === 1 ? "region" : "regions"} boxed.`,
      wipe({
        title: shot.title,
        before: ca!.jpeg,
        after: cb!.jpeg,
        boxes: within(boxes, area, area.width),
        width,
      }),
    );
    continue;
  }

  const length = 3.6;
  const scroll = 1.2;

  const options = {
    viewport: VIEWPORT,
    selector: shot.selector,
    scroll,
    hold: length - scroll,
    width: VIEWPORT.width,
    scheme: shot.scheme,
  };

  const [fa, fb] = [
    resample(await film(from, options), 10, length),
    resample(await film(to, options), 10, length),
  ];

  // The scroll itself jitters between runs, so only frames after it lands are compared.
  const boxes = (
    await Promise.all(
      fa.map((f, i) => (f.t > scroll + 0.1 && fb[i] ? changes(f.jpeg, fb[i].jpeg) : [])),
    )
  ).flat();

  const area = region(boxes, VIEWPORT, { pad: 32 });

  if (!area) {
    unchanged.push(shot.title);
    continue;
  }

  // Frames at 1.25x the drawn width: sharp on most screens, and the film is most of the file.
  const width = Math.min(440, area.width);
  const pixels = Math.min(area.width, Math.round(width * 1.25));

  const films = [
    { label: "production", frames: dedupe(await crop(fa, area, pixels, 0.55)) },
    { label: "this branch", frames: dedupe(await crop(fb, area, pixels, 0.55)) },
  ];

  await write(
    shot.name,
    shot.title,
    `The same ${scroll}s scroll filmed on each side, cropped to where they differ once it lands.`,
    flipbook({ title: shot.title, films, length, width }),
  );
}

await close();

const markdown = (url: (file: string) => string) =>
  [
    "## Reels",
    `Built by \`bun run reel/make.ts\` in \`examples/\`.`,
    ...reels.map(({ file, title, note }) => `### ${title}\n${note}\n\n![${title}](${url(file)})`),
    unchanged.length ? `Unchanged, so left out: ${unchanged.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

await Bun.write(
  join(OUT, "reel.md"),
  markdown((file) => `./${basename(file)}`),
);

console.log(`${reels.length} reels, ${unchanged.length} unchanged: reel/out/reel.md`);

if (values.pr && reels.length > 0) {
  const url = publish(
    Number(values.pr),
    reels.map((r) => r.file),
    markdown,
  );

  console.log(`posted to ${url}`);
}
