import type { CaptureDiagnostic } from "./tree.ts";

export function diagnose({ selector }: { selector: string }): CaptureDiagnostic[] {
  const root = document.querySelector(selector);

  if (!root) return [];

  const bounds =
    root === document.body || root === document.documentElement
      ? new DOMRect(0, 0, innerWidth, innerHeight)
      : root.getBoundingClientRect();

  const loaded = new Set(
    [...document.fonts].flatMap((face) =>
      face.status === "loaded" ? [face.family.replace(/^["']|["']$/g, "").toLowerCase()] : [],
    ),
  );

  const findings: CaptureDiagnostic[] = [];

  const name = (el: Element): string => {
    const part = el.getAttribute("data-part");

    if (part) return `[data-part=${JSON.stringify(part)}]`;

    if (el.id) return `#${CSS.escape(el.id)}`;
    const parent = el.parentElement;

    const index = parent
      ? [...parent.children].filter((sibling) => sibling.localName === el.localName).indexOf(el) + 1
      : 1;

    return el === root || !parent
      ? el.localName
      : `${name(parent)} > ${el.localName}:nth-of-type(${index})`;
  };

  const visit = (el: Element): void => {
    const style = getComputedStyle(el);

    if (style.display === "none" || Number(style.opacity) === 0) return;
    const b = el.getBoundingClientRect();

    if (
      style.visibility === "visible" &&
      b.width > 0 &&
      b.height > 0 &&
      b.right > bounds.left &&
      b.left < bounds.right &&
      b.bottom > bounds.top &&
      b.top < bounds.bottom
    ) {
      const warn = (code: CaptureDiagnostic["code"], message: string, family?: string) =>
        findings.push({ code, element: name(el), message, ...(family && { family }) });

      if (/\bconic-gradient\(/.test(style.backgroundImage))
        warn("background", "The SVG omits the conic gradient background.");

      if (/gradient\(/.test(style.maskImage))
        warn("mask", "The SVG clips to the mask box and omits the gradient fade.");

      if (/blur\(/.test(style.backdropFilter))
        warn("backdrop", "The SVG simplifies backdrop blur and may increase the fill opacity.");

      const text = [...el.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );

      if (text || el.matches("input, textarea")) {
        if (style.fontFeatureSettings !== "normal" || style.fontVariantNumeric !== "normal")
          warn("font-features", "The SVG omits custom OpenType and numeric font settings.");

        const family = style.fontFamily
          .split(",")[0]
          ?.trim()
          .replace(/^["']|["']$/g, "");

        if (family && loaded.has(family.toLowerCase()))
          warn(
            "font-fallback",
            `Could not embed "${family}". The SVG may use a fallback font.`,
            family,
          );
      }
    }

    for (const child of el.children) visit(child);

    for (const child of el.shadowRoot?.children ?? []) visit(child);
  };

  visit(root);

  return findings;
}
