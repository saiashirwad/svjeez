// Builds every reel for the PR into reel/out/. Pages come from REEL_BEFORE (production by default) and REEL_AFTER (a
// preview of this branch), scenes from REEL_BASE (main) and this checkout.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { renderVideo } from "@svjeez/video";
import { validateSvg } from "svjeez";
import { changes, close, crop, film, resample, still } from "./capture";
import { compare } from "./compare";
import { flipbook, wipe } from "./scenes";
import { atRef, here, renderAs } from "./source";

const OUT = join(import.meta.dir, "out");
const BASE = process.env.REEL_BASE ?? "main";
const BEFORE = process.env.REEL_BEFORE ?? "https://svjeez.texoport.in/";
const AFTER = process.env.REEL_AFTER ?? "http://localhost:4330/";
const only = process.argv.slice(2);
const wants = (name: string) => only.length === 0 || only.includes(name);
await mkdir(OUT, { recursive: true });

const write = async (name: string, svg: string) => {
  const { warnings } = validateSvg(svg);
  await Bun.write(join(OUT, name), svg);
  console.log(
    `${name}  ${(svg.length / 1024).toFixed(1)} KB${warnings.length ? `  (${warnings.join("; ")})` : ""}`,
  );

  return svg;
};

// 1. A scene diff in vector: both copies of the scene, live, in one SVG.
if (wants("compare")) {
  const scene = "examples/site/icons.tsx";
  const before = renderAs("b", await atRef(BASE, scene));
  const after = renderAs("h", await here(scene));
  await write(
    "icons-compare.svg",
    compare(before, after, { title: "icons.tsx, before and after" }),
  );
}

// 2. A still of the hero on each side, wiped between, with the changed regions boxed.
if (wants("wipe")) {
  const viewport = { width: 1440, height: 900 };
  const [a, b] = [await still(BEFORE, viewport), await still(AFTER, viewport)];
  const boxes = await changes(a, b);
  console.log(`hero: ${boxes.length} changed regions`, boxes);
  const svg = await write(
    "hero-wipe.svg",
    wipe({ title: "Landing page hero", before: a, after: b, boxes, width: 960 }),
  );
  if (wants("video")) {
    const video = await renderVideo(svg, { format: "mp4", fps: 30, scale: 1 });
    await Bun.write(join(OUT, "hero-wipe.mp4"), video.bytes);
    console.log(`hero-wipe.mp4  ${(video.bytes.length / 1024).toFixed(1)} KB`);
  }
}

// 3. The same scroll filmed on each side, played as a flipbook.
if (wants("film")) {
  const length = 3.6;
  const options = {
    viewport: { width: 1440, height: 900 },
    selector: "#icons",
    scroll: 1.2,
    hold: length - 1.2,
    width: 1440,
  };
  // Where the icons window sits once the scroll lands, in viewport pixels.
  const region = { x: 180, y: 180, width: 540, height: 400 };
  const films = [
    {
      label: "production",
      frames: await crop(resample(await film(BEFORE, options), 12, length), region, 400),
    },
    {
      label: "this branch",
      frames: await crop(resample(await film(AFTER, options), 12, length), region, 400),
    },
  ];
  for (const f of films) console.log(`${f.label}: ${f.frames.length} frames`);
  const svg = await write(
    "icons-film.svg",
    flipbook({ title: "Scrolling to the icons section", films, length, width: 400 }),
  );
  if (wants("video")) {
    const video = await renderVideo(svg, { format: "mp4", fps: 30, scale: 1 });
    await Bun.write(join(OUT, "icons-film.mp4"), video.bytes);
    console.log(`icons-film.mp4  ${(video.bytes.length / 1024).toFixed(1)} KB`);
  }
}

await close();
