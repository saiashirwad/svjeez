import { afterEach, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const fixture = new URL(
  "../../../svjeez/test/fixtures/ABeeZee-Regular.ttf",
  import.meta.url,
);

const realFetch = globalThis.fetch;

export const stubFetch = (stub: () => Promise<Response>) => {
  globalThis.fetch = Object.assign(stub, { preconnect: realFetch.preconnect });
};

export const useFontCache = () => {
  const state = { dir: "" };

  beforeEach(() => {
    state.dir = mkdtempSync(join(tmpdir(), "svjeez-fonts-"));
    process.env.SVJEEZ_FONTS_CACHE = state.dir;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.SVJEEZ_FONTS_CACHE;
    rmSync(state.dir, { recursive: true, force: true });
  });

  return state;
};
