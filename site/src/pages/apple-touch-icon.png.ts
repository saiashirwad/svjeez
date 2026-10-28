import type { APIRoute } from "astro";
import { renderFrames } from "svjeez/frames";
import mark from "../../public/favicon.svg?raw";

export const GET: APIRoute = async () => {
  const { frames } = await renderFrames(mark, { times: [0], colorScheme: "light", scale: 180 / 208 });
  return new Response(new Uint8Array(frames[0]!.png), { headers: { "Content-Type": "image/png" } });
};
