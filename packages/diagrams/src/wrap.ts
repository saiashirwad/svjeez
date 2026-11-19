import type { Look } from "./kit.tsx";

/** Breaks text into lines no wider than `width`, splitting a word that is too long on its own. */
export const wrap = (l: Look, text: string, size: number, width: number): string[] => {
  const fits = (s: string) => l.measure(s, size, l.weight) <= width;
  const lines: string[] = [];
  let at = "";

  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    const next = at === "" ? word : `${at} ${word}`;

    if (fits(next)) {
      at = next;
      continue;
    }

    if (at !== "") lines.push(at);
    at = "";

    for (const char of word) {
      if (at !== "" && !fits(at + char)) {
        lines.push(at);
        at = "";
      }

      at += char;
    }
  }

  if (at !== "") lines.push(at);

  return lines;
};
