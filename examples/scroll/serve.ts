const page = import.meta.dir + "/page.ts";

Bun.serve({
  port: 4826,
  async fetch(request) {
    const mode = new URL(request.url).searchParams.get("mode") ?? "";
    const run = Bun.spawn(["bun", "run", page, mode], { stdout: "pipe", stderr: "pipe" });

    const [html, error] = await Promise.all([
      new Response(run.stdout).text(),
      new Response(run.stderr).text(),
    ]);

    if ((await run.exited) !== 0) return new Response(error, { status: 500 });

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
});

console.log("http://localhost:4826");
