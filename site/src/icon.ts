import { renderFrames } from "svjeez/frames";
import mark from "../public/favicon.svg?raw";

/** The chick favicon as a PNG, size by size. */
export async function iconPng(size: number): Promise<Uint8Array> {
  const { frames } = await renderFrames(mark, {
    times: [0],
    colorScheme: "light",
    scale: size / 208,
  });

  return new Uint8Array(frames[0]!.png);
}

export const png = (bytes: Uint8Array) =>
  new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png" } });
