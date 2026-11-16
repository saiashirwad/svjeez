/**
 * The animations an SVG asks the browser to run on every frame, counted from the file alone so it does not wobble like
 * a timing. Chrome ticks every running animation each frame, even while its value holds: each CSS animation on an
 * element (they all loop), and each SMIL `<animate>` or `<set>` for the share of the loop its interval covers.
 */
const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

export const costOf = (svg: string): number => {
  const styles = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n");
  // The number of keyframes each class runs.
  const counts = new Map<string, number>();

  for (const m of styles.matchAll(/\.([\w-]+)\{animation-name:([^;}]*)/g))
    counts.set(m[1]!, m[2]!.split(",").length);

  let running = 0;

  for (const m of svg.matchAll(/<\w+\s[^>]*\bclass="([^"]*)"/g))
    for (const name of m[1]!.split(/\s+/)) running += counts.get(name) ?? 0;

  for (const m of svg.matchAll(/<(?:animate|set|animateTransform)\s[^>]*>/g)) {
    const dur = parseFloat(attr(m[0], "dur") ?? "");
    const loop = parseFloat(attr(m[0], "data-loop") ?? "");

    running +=
      attr(m[0], "repeatCount") === "indefinite" || !(dur > 0) || !(loop > 0)
        ? 1
        : Math.min(1, dur / loop);
  }

  return Math.round(running * 10) / 10;
};
