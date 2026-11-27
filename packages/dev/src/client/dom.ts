import type { ControlValue } from "@svjeez/live";

/** Small DOM helpers for the page. */

export const isNumber = (value: ControlValue): value is number => typeof value === "number";

export const isText = (value: ControlValue): value is string => typeof value === "string";

export const isBoolean = (value: ControlValue): value is boolean => typeof value === "boolean";

export const byId = (id: string): HTMLElement => {
  const found = document.getElementById(id);

  if (!found) throw new Error("The page has no #" + id + ".");

  return found;
};

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);

  if (className) node.className = className;

  if (text) node.textContent = text;

  return node;
};

export const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * An SVG whose ids are prefixed, with every reference to them: `url(#a)`, `href="#a"`, `#a` in its CSS and
 * `a.end` in SMIL timing. Several copies of one drawing can then share a page without one copy's gradients, clips
 * and keyframes resolving to another's.
 */
export const scoped = (svg: string, prefix: string): string => {
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] ?? ""));

  ids.delete("");

  if (ids.size === 0) return svg;

  const names = [...ids]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  const hash = new RegExp("#(" + names + ")(?![\\w-])", "g");
  const timing = new RegExp("(^|[\\s;+-])(" + names + ")\\.(begin|end|click)", "g");

  return svg
    .replace(
      /(\sid=")([^"]+)(")/g,
      (_, open: string, id: string, close: string) => open + prefix + id + close,
    )
    .replace(hash, (_, id: string) => "#" + prefix + id)
    .replace(
      /(\s(?:begin|end)=")([^"]*)(")/g,
      (_, open: string, value: string, close: string) =>
        open +
        value.replace(
          timing,
          (__, lead: string, id: string, event: string) => lead + prefix + id + "." + event,
        ) +
        close,
    )
    .replace(
      /(\saria-labelledby=")([^"]*)(")/g,
      (_, open: string, value: string, close: string) =>
        open +
        value
          .split(/\s+/)
          .map((id) => (ids.has(id) ? prefix + id : id))
          .join(" ") +
        close,
    );
};

/** The width over the height of an SVG's viewBox, for a frame of the right shape. */
export const aspectOf = (svg: string): number => {
  const box = /viewBox="([^"]+)"/
    .exec(svg)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);

  const [, , width = 16, height = 9] = box ?? [];

  return width > 0 && height > 0 ? width / height : 16 / 9;
};

/** A number for a person: at most three decimals, no trailing zeros. */
export const shown = (value: number): string => String(Number(value.toFixed(3)));

/**
 * Puts an SVG in its own shadow root under `holder`, so the styles a scene ships (its keyframes, its `svg { … }`
 * rules) apply to that copy alone and never to the page or to another copy. Returns the SVG element.
 */
export const mount = (holder: HTMLElement, svg: string, css: string): SVGSVGElement | null => {
  const root = holder.shadowRoot ?? holder.attachShadow({ mode: "open" });

  root.innerHTML = "<style>" + css + "</style>" + svg;

  return root.querySelector("svg");
};
