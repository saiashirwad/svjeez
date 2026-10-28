import { font } from "svjeez";

/** JetBrains Mono, embedded by the diagram examples so their labels look the same on every machine. */
export const mono = await font.load(new URL("./JetBrainsMono.ttf", import.meta.url), { fallback: ["ui-monospace", "Menlo", "monospace"] });
