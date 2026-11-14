import type { APIRoute } from "astro";
import { iconPng } from "../icon";

// An ICO is a small header and a directory entry in front of the image, which may be a PNG.
export const GET: APIRoute = async () => {
  const image = await iconPng(48);
  const ico = new Uint8Array(22 + image.length);
  const view = new DataView(ico.buffer);

  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, 1, true); // one image
  ico[6] = 48; // width
  ico[7] = 48; // height
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, image.length, true); // image size
  view.setUint32(18, 22, true); // offset of the image
  ico.set(image, 22);

  return new Response(ico, { headers: { "Content-Type": "image/x-icon" } });
};
