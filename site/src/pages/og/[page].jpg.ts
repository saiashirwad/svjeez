import type { APIRoute, GetStaticPaths } from "astro";
import { renderFrames } from "svjeez/frames";
import { card, exampleCard, type Mood } from "@examples/site/lib/og.tsx";
import { close, encode } from "@svjeez/vite/encode";
import { examples } from "../../examples";

const MOODS: readonly Mood[] = ["home", "intro", "examples", "play", "lost"];

export const getStaticPaths = (() => [
  ...MOODS.map((mood) => ({ params: { page: mood } })),
  ...examples.map(({ name }) => ({ params: { page: `ex-${name}` } })),
]) satisfies GetStaticPaths;

const still = async (svg: string) => {
  const held = Number(/animation-delay:-([\d.]+)s!important/.exec(svg)?.[1] ?? 0);
  const { frames } = await renderFrames(svg, { times: [held], colorScheme: "light", scale: 1 });

  return Buffer.from(frames[0]!.png).toString("base64");
};

const svgFor = async (page: string) => {
  const example = examples.find(({ name }) => `ex-${name}` === page);

  if (!example) {
    // SAFETY: the route's static paths are only example names and the mood names, so a non-example page is a Mood.
    return card(page as Mood);
  }

  const { svg, title, width, height } = example.scene;

  return exampleCard(title, await still(svg), width / height);
};

export const GET: APIRoute = async ({ params }) => {
  const svg = await svgFor(params.page!);
  const { frames } = await renderFrames(svg, { times: [0], colorScheme: "light" });
  const jpeg = await encode(frames[0]!.png, "jpeg", 0.9);
  await close();

  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
};
