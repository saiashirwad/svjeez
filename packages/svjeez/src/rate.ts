/** The root attribute that carries a scene's `playbackRate`, when it isn't 1, for the tools that take scene seconds. */
export const RATE_ATTR = "data-playback-rate";

/** The playback rate a rendered SVG was made with: 1 unless its root says otherwise. */
export const rateOf = (svg: string): number => {
  const rate = parseFloat(
    new RegExp(`\\s${RATE_ATTR}="([\\d.]+)"`).exec(/<svg\b[^>]*>/.exec(svg)?.[0] ?? "")?.[1] ?? "",
  );

  return rate > 0 ? rate : 1;
};
