// The site's default link-preview card, kept at /og.jpg for links shared before each page had its own: the home card.
import type { APIRoute } from "astro";
import { renderFrames } from "svjeez/frames";
import { card } from "@examples/site/og.tsx";
import { close, encode } from "@svjeez/vite/encode";

export const GET: APIRoute = async () => {
  const { frames } = await renderFrames(card("home"), { times: [0], colorScheme: "light" });
  const jpeg = await encode(frames[0]!.png, "jpeg", 0.9);
  await close();

  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
};
