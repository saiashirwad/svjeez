import { GUARD } from "./runner.ts";

/**
 * The module every loop in a scene calls into. It counts iterations across all files and throws past `limit`, so
 * `while (true) {}` fails instead of freezing a host that has no CPU limit of its own.
 */
export const guardSource = (limit: number): string =>
  [
    `let left = ${limit};`,
    `export const reset = () => { left = ${limit}; };`,
    `export const tick = () => {`,
    `  if (--left < 0) throw new RangeError("A loop ran over ${limit} iterations. Is it missing an exit?");`,
    `};`,
    "",
  ].join("\n");

/** The call each loop body starts with, and the import that provides it. */
export const TICK = "__svzTick";

export const guardImport = `import { tick as ${TICK} } from "${GUARD}";`;
