import { join } from "node:path";

export const cliPath = join(import.meta.dir, "../../src/cli.ts");

export const cli = (...args: string[]) => Bun.spawnSync([process.execPath, cliPath, ...args]);
