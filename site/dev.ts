// Local preview without Alchemy: serves site/public, with the stylesheet and script read straight from site/ so CSS and JS
// edits show on reload. Nothing is cached. Run `bun run build` first, and again after changing index.html or a scene.
const here = (path: string) => new URL(path, import.meta.url).pathname;
const live = new Set(["/site.css", "/site.js", "/favicon.svg", "/intro.html"]);
const port = Number(process.env.PORT ?? 4321);

Bun.serve({
  port,
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const candidates = live.has(path) ? [here(`.${path}`)] : [path, `${path}.html`, `${path}/index.html`].map((p) => here(`public${p}`));
    for (const candidate of candidates) {
      const file = Bun.file(candidate);
      if (!candidate.endsWith("/") && (await file.exists())) return new Response(file, { headers: { "Cache-Control": "no-store" } });
    }
    return new Response("Not found", { status: 404 });
  },
});
console.log(`http://localhost:${port}`);
