import { google, type GoogleOptions } from "@svjeez/fonts";

const options: GoogleOptions = { weight: 500, ligatures: false };

export const geist = await google("Geist", options);
export const abeezee = await google.family("ABeeZee", [400, { weight: 400, style: "italic" }]);
