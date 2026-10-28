import { font } from "svjeez";

/** JetBrains Mono, embedded so code and diagram labels look the same on every machine. Ligatures off keeps the subset small. */
export const mono = await font.load(new URL("./JetBrainsMono.ttf", import.meta.url), {
  fallback: ["ui-monospace", "Menlo", "monospace"],
  ligatures: false,
});

/** Geist's ligatures would embed each whole face, so they are off, as for JetBrains Mono. */
const geistFace = (file: string) =>
  font.load(new URL(`./${file}.ttf`, import.meta.url), { ligatures: false });

/** Geist, by Vercel and basement.studio, in two weights: 400 for text and 600 for headings. Each face embeds once. */
export const geist = font.family(
  await geistFace("Geist-Regular"),
  await geistFace("Geist-SemiBold"),
);

/** Geist Mono at 500, for figures and small capitals beside Geist. Labels only; code takes `mono`. */
export const geistMono = await geistFace("GeistMono-Medium");
