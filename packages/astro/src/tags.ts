import type { StillImage } from "@svjeez/vite/scene";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The `<meta>` tags that make a page's link preview: the image, its size and type, what it shows, and the card kind. */
export const ogTags = (image: StillImage, site: URL, alt: string = image.desc): string => {
  const url = new URL(image.src, site).href;

  return [
    ["property", "og:image", url],
    ["property", "og:image:type", image.type],
    ["property", "og:image:width", String(image.width)],
    ["property", "og:image:height", String(image.height)],
    ...(alt ? [["property", "og:image:alt", alt]] : []),
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:image", url],
  ]
    .map(([kind, name, content]) => `<meta ${kind}="${name}" content="${escape(content!)}" />`)
    .join("\n    ");
};
