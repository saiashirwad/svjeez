export const RATE_ATTR = "data-playback-rate";

export const rateOf = (svg: string): number => {
  const rate = parseFloat(
    new RegExp(`\\s${RATE_ATTR}="([\\d.]+)"`).exec(/<svg\b[^>]*>/.exec(svg)?.[0] ?? "")?.[1] ?? "",
  );

  return rate > 0 ? rate : 1;
};
