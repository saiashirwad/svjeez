import { font } from "svjeez";

/** JetBrains Mono, embedded so code and diagram labels look the same on every machine. Ligatures off keeps the subset small. */
export const mono = await font.load(new URL("./JetBrainsMono.ttf", import.meta.url), { fallback: ["ui-monospace", "Menlo", "monospace"], ligatures: false });
