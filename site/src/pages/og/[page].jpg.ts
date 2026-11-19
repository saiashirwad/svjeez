import type { APIRoute, GetStaticPaths } from "astro";
import { renderFrames } from "svjeez/frames";
import { svg } from "svjeez/tools";
import { close, encode } from "@svjeez/vite/encode";
import { card, type Page } from "../../scenes/og";

const PAGES: readonly Page[] = ["home", "lost"];

export const getStaticPaths = (() =>
  PAGES.map((page) => ({ params: { page } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  // SAFETY: getStaticPaths only makes the pages in PAGES.
  const { frames } = await renderFrames(svg.emit(card(params.page as Page)), {
    times: [0],
    colorScheme: "light",
  });

  const jpeg = await encode(frames[0]!.png, "jpeg", 0.9);
  await close();

  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
};
