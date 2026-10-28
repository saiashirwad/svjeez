import { motion, rect } from "svjeez";
import { adaptive, appWindow, base16, type Base16, type CodePiece, type CodeTokens } from "svjeez/extras";

// One calm palette for every scene on the site: white and system gray by day, near-black by night.
// Accents follow the system colors, so the traffic lights double as the code colors.
export const { theme, css: themeCss } = adaptive({
  light: base16("#FFFFFF", "#F5F5F7", "#E5E5EA", "#8E8E93", "#6E6E73", "#1D1D1F", "#1D1D1F", "#000000", "#E5453B", "#E8751A", "#E5A50A", "#2FA84F", "#1B9AAA", "#0A6CFF", "#9B51E0", "#A66B43"),
  dark: base16("#1E1E20", "#2A2A2D", "#3A3A3D", "#7C7C82", "#A1A1A6", "#E5E5EA", "#F5F5F7", "#FFFFFF", "#FF6961", "#FF9F0A", "#FFD60A", "#32D74B", "#64D2FF", "#5EA0FF", "#C58AFF", "#AC8E68"),
});

/** A terminal stays dark in both schemes, like the real one. */
export const termTheme = base16("#1C1C1E", "#2C2C2E", "#3A3A3C", "#7C7C82", "#A1A1A6", "#E5E5EA", "#F5F5F7", "#FFFFFF", "#FF6961", "#FF9F0A", "#FFD60A", "#32D74B", "#64D2FF", "#5EA0FF", "#C58AFF", "#AC8E68");

const MONO = "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif";
const ROUND = "ui-rounded,'SF Pro Rounded',-apple-system,system-ui,sans-serif";

export const CSS = [
  themeCss,
  `.mono,.mono text{font-family:${MONO};font-variant-ligatures:none}`,
  `.sans text,.sans{font-family:${SANS}}`,
  `.round text,.round{font-family:${ROUND};font-variant-numeric:tabular-nums}`,
].join("\n");

/** Seeded, so every build scatters things the same way. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const KEYWORDS = new Set(["import", "from", "export", "default", "const", "return", "await", "async", "type", "new"]);
const TOKEN = /(\/\/.*)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|(<\/?[A-Za-z][\w.]*|<\/?>|\/>)|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)|([{}()[\];,=:.<>+*!?&|-]+)|(\s+)|(.)/g;

/** A small TSX highlighter: enough colors for the snippets on the site, nothing more. */
export const highlight = (source: string): CodeTokens =>
  source.split("\n").map((line) =>
    [...line.matchAll(TOKEN)].map((m): CodePiece => {
      const text = m[0];
      if (m[1]) return ["comment", text];
      if (m[2]) return ["string", text];
      if (m[3]) return ["number", text];
      if (m[4]) return ["tag", text];
      if (m[5]) return ["fn", text];
      if (m[6]) return KEYWORDS.has(text) ? ["keyword", text] : text;
      if (m[7]) return ["punct", text];
      return text;
    }),
  );

/** The window every card shares: traffic lights, a title bar, square corners the page rounds off with its own box. */
export const chrome = (w: number, h: number, title: string, options: { theme?: Base16; bar?: number } = {}) =>
  appWindow(rect(0.5, 0.5, w - 1, h - 1), { theme: options.theme ?? theme, title, dots: "traffic", bar: options.bar ?? 40, radius: 12, class: "sans" });

/** Fade everything out just before the loop restarts, so the jump back to the first frame is not seen. */
export const outro = (duration: number) => motion({ opacity: 1 }).at(duration - 0.5).to({ opacity: 0 }, 0.5);
