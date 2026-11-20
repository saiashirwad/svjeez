import { google, type GoogleOptions } from "@svjeez/fonts";
import { casual, handwrite } from "@svjeez/fonts/handwriting";

const options: GoogleOptions = { weight: 500, ligatures: false };

export const geist = await google("Geist", options);

export const abeezee = await google.family("ABeeZee", [
  { weight: 400 },
  { weight: 400, italic: true },
]);

export const pen = handwrite(await casual(), "hi", { width: 100, y: 40 });
