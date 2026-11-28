/** Launching Chromium and reading an SVG's size, shared by `renderFrames` and `measurePerf`. Internal: its types name playwright-core, which consumers may not have. */
import { hostOf } from "./host";

/** `full` prefers a full Chrome or Chromium over the headless shell, which composites in software and so misjudges playback. */
export const launch = async (caller: string, executablePath?: string, full = false) => {
  const { chromium } = await import("playwright-core").catch(() => {
    throw new Error(
      `${caller} needs playwright-core. Install it with \`npm i -D playwright-core\`, then \`npx playwright-core install chromium-headless-shell\`.`,
    );
  });

  if (full && !executablePath)
    for (const channel of ["chrome", "chromium"])
      try {
        return await chromium.launch({ channel });
      } catch {
        // Not installed: try the next one.
      }

  try {
    return await chromium.launch({ executablePath });
  } catch (error) {
    if (executablePath) throw error;

    return chromium.launch({ channel: "chrome" }).catch(() => {
      throw new Error(
        `No Chromium to render with. Run \`${hostOf().installBrowser ?? "npx playwright-core install chromium-headless-shell"}\`, or pass executablePath.\n${error instanceof Error ? error.message : error}`,
      );
    });
  }
};

export const size = (caller: string, svg: string) => {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const width = parseFloat(/\swidth="([\d.]+)"/.exec(root)?.[1] ?? "");
  const height = parseFloat(/\sheight="([\d.]+)"/.exec(root)?.[1] ?? "");

  if (!(width > 0 && height > 0))
    throw new Error(
      `${caller} needs an <svg> root with numeric width and height, got ${width} by ${height}.`,
    );

  return { width, height };
};
