import type { APIRoute } from "astro";
import { iconPng } from "../icon";

export const GET: APIRoute = async () => {
  const image = await iconPng(48);
  const ico = new Uint8Array(22 + image.length);
  const view = new DataView(ico.buffer);

  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  ico[6] = 48;
  ico[7] = 48;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, image.length, true);
  view.setUint32(18, 22, true);
  ico.set(image, 22);

  return new Response(ico, { headers: { "Content-Type": "image/x-icon" } });
};
