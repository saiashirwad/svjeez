import { google } from "@svjeez/fonts";

export const mono = await google("JetBrains Mono", {
  fallback: ["ui-monospace", "Menlo", "monospace"],
  ligatures: false,
});

export const geist = await google.family("Geist", [{ weight: 400 }, { weight: 600 }], {
  ligatures: false,
});

export const geistText = await google.family(
  "Geist",
  [{ weight: 400 }, { weight: 600 }, { weight: 400, style: "italic" }],
  { ligatures: false },
);
