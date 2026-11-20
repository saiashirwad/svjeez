import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cardBeside } from "../src/index.ts";

test("cardBeside prefers a page's own card, else walks up to _default.og.* inside pages", () => {
  const root = mkdtempSync(join(tmpdir(), "svjeez-astro-cards-"));

  try {
    const pages = join(root, "src/pages");
    const blog = join(pages, "blog");
    const nested = join(blog, "2026");
    mkdirSync(nested, { recursive: true });

    const rootFallback = join(pages, "_default.og.tsx");
    const blogFallback = join(blog, "_default.og.tsx");
    const ownCard = join(nested, "_post.og.tsx");
    const outsideFallback = join(root, "src/_default.og.tsx");

    writeFileSync(outsideFallback, "");
    writeFileSync(rootFallback, "");
    writeFileSync(blogFallback, "");
    writeFileSync(ownCard, "");

    expect(cardBeside(join(nested, "post.astro"), pages)).toBe(ownCard);
    expect(cardBeside(join(nested, "other.astro"), pages)).toBe(blogFallback);
    expect(cardBeside(join(pages, "about.astro"), pages)).toBe(rootFallback);

    rmSync(rootFallback);
    expect(cardBeside(join(pages, "about.astro"), pages)).toBeUndefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
