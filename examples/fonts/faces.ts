import { google } from "@svjeez/fonts";

/** JetBrains Mono, embedded so code and diagram labels look the same on every machine. Ligatures off keeps the subset small. */
export const mono = await google("JetBrains Mono", {
  fallback: ["ui-monospace", "Menlo", "monospace"],
  ligatures: false,
});

/** Geist, by Vercel and basement.studio, in two weights: 400 for text and 600 for headings. Each face embeds once. Ligatures are off, as for JetBrains Mono, because they would embed each whole face. */
export const geist = await google.family("Geist", [{ weight: 400 }, { weight: 600 }], {
  ligatures: false,
});

/**
 * Geist with its italic, for prose that sets a word in italic or semibold. The scene model embeds only the faces its
 * text draws, so a scene that never says italic carries none of it.
 */
export const geistText = await google.family(
  "Geist",
  [{ weight: 400 }, { weight: 600 }, { weight: 400, style: "italic" }],
  { ligatures: false },
);

/** Geist Mono at 500, for figures and small capitals beside Geist. Labels only; code takes `mono`. */
export const geistMono = await google("Geist Mono", { weight: 500, ligatures: false });
