import { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { SceneError } from "svjeez/tools";
import {
  apply,
  identity,
  multiply,
  parseTransform,
  scale,
  translate,
  type Matrix,
} from "./matrix.ts";
import { boxRing, mapRing, parsePath, pointsOf, reversed, type Ring } from "./path.ts";

export interface Mark {
  readonly char: string;
  readonly rings: readonly Ring[];
  readonly color?: string;
  readonly parts: readonly string[];
}

export interface Typeset {
  readonly box: readonly [x: number, y: number, width: number, height: number];
  readonly marks: readonly Mark[];
}

type Node = LiteElement;

const PACKAGES = AllPackages.filter((name) => name !== "noundefined" && name !== "noerrors");

const adaptor = liteAdaptor();

let document: ReturnType<typeof mathjax.document> | undefined;

const convert = (source: string, display: boolean): Node => {
  if (!document) {
    RegisterHTMLHandler(adaptor);
    document = mathjax.document("", {
      InputJax: new TeX({ packages: PACKAGES }),
      OutputJax: new SVG({ fontCache: "none" }),
    });
  }

  return document.convert(source, { display });
};

const num = (node: Node, name: string): number => Number(adaptor.getAttribute(node, name) ?? 0);

const placed = (rings: readonly Ring[], m: Matrix): Ring[] =>
  rings.map((ring) => mapRing(ring, ([x, y]) => apply(m, x, y)));

const isBox = (ring: Ring): boolean =>
  ring.segments.length === 4 &&
  ring.segments.every(({ to, via }, i) => {
    const from = i === 0 ? ring.start : ring.segments[i - 1]!.to;

    return !via && (to[0] === from[0] || to[1] === from[1]);
  });

type ClipRect = readonly [x0: number, y0: number, x1: number, y1: number];

const clipped = (rings: readonly Ring[], [x0, y0, x1, y1]: ClipRect, quoted: string): Ring[] =>
  rings.map((ring) => {
    const points = pointsOf(ring);

    const inside = points.every(
      ([x, y]) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6,
    );

    if (inside) return ring;

    if (!isBox(ring))
      throw new SceneError(
        `<Tex> can't draw ${quoted}: a stretched symbol in it is built from pieces it can't cut.`,
        "Write it without that stretchy command, or with a fixed-size symbol.",
      );
    const xs = points.map(([x]) => Math.min(Math.max(x, x0), x1));
    const ys = points.map(([, y]) => Math.min(Math.max(y, y0), y1));
    const [left, top] = [Math.min(...xs), Math.min(...ys)];

    return boxRing(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
  });

const lineRing = (node: Node): Ring => {
  const width = num(node, "stroke-width");
  const [x1, y1, x2, y2] = [num(node, "x1"), num(node, "y1"), num(node, "x2"), num(node, "y2")];
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [nx, ny] = [((y2 - y1) / length) * (width / 2), ((x1 - x2) / length) * (width / 2)];

  return {
    start: [x1 + nx, y1 + ny],
    segments: [
      { to: [x2 + nx, y2 + ny] },
      { to: [x2 - nx, y2 - ny] },
      { to: [x1 - nx, y1 - ny] },
      { to: [x1 + nx, y1 + ny] },
    ],
  };
};

const rectRings = (node: Node): Ring[] => {
  const [x, y, w, h] = [num(node, "x"), num(node, "y"), num(node, "width"), num(node, "height")];

  if (adaptor.getAttribute(node, "fill") !== "none") return [boxRing(x, y, w, h)];
  const half = num(node, "stroke-width") / 2;

  return [
    boxRing(x - half, y - half, w + half * 2, h + half * 2),
    reversed(boxRing(x + half, y + half, w - half * 2, h - half * 2)),
  ];
};

interface Inherited {
  readonly matrix: Matrix;
  readonly color?: string;
  readonly parts: readonly string[];
  readonly clip?: { readonly matrix: Matrix; readonly rect: ClipRect };
}

export function typeset(source: string, display: boolean): Typeset {
  const quoted = JSON.stringify(source);
  let container: Node;

  try {
    container = convert(source, display);
  } catch (error) {
    throw new SceneError(
      `<Tex> can't read ${quoted}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const svg = adaptor
    .childNodes(container)
    .find(
      (node): node is LiteElement & { kind: "svg" } =>
        node instanceof LiteElement && node.kind === "svg",
    );

  const view = (svg ? (adaptor.getAttribute(svg, "viewBox") ?? "") : "").split(/\s+/).map(Number);

  if (!svg || view.length !== 4 || view.some(Number.isNaN))
    throw new SceneError(
      `<Tex> can't place ${quoted}: it has no size of its own.`,
      "Leave out \\tag and full-width environments.",
    );
  const marks: Mark[] = [];

  const walk = (parent: Node, inherited: Inherited) => {
    for (const node of adaptor.childNodes(parent)) {
      if (!(node instanceof LiteElement) || node.kind === "title") continue;
      const kind = node.kind;
      const error = adaptor.getAttribute(node, "data-mjx-error");

      if (error !== undefined) throw new SceneError(`<Tex> can't read ${quoted}: ${error}`);
      const color = adaptor.getAttribute(node, "fill");
      const id = adaptor.getAttribute(node, "id");

      const here: Inherited = {
        ...inherited,
        matrix: multiply(
          inherited.matrix,
          parseTransform(adaptor.getAttribute(node, "transform"), quoted),
        ),
        ...(color && color !== "none" && color !== "currentColor" && { color }),
        parts: id ? [...inherited.parts, id] : inherited.parts,
      };

      const mark = (char: string, rings: readonly Ring[]) => {
        const inner = placed(rings, here.matrix);

        marks.push({
          char,
          rings: here.clip
            ? placed(clipped(inner, here.clip.rect, quoted), here.clip.matrix)
            : inner,
          ...(here.color !== undefined && { color: here.color }),
          parts: here.parts,
        });
      };

      if (kind === "g" || kind === "a") walk(node, here);
      else if (kind === "svg") {
        const [vx, vy, vw, vh] = (adaptor.getAttribute(node, "viewBox") ?? "")
          .split(/\s+/)
          .map(Number);

        const [w, h] = [num(node, "width"), num(node, "height")];

        const fit = multiply(
          multiply(here.matrix, translate(num(node, "x"), num(node, "y"))),
          multiply(scale(w / vw!, h / vh!), translate(-vx!, -vy!)),
        );

        walk(node, {
          ...here,
          matrix: identity,
          clip: { matrix: fit, rect: [vx!, vy!, vx! + vw!, vy! + vh!] },
        });
      } else if (kind === "text") {
        const drawn = adaptor.textContent(node).trim();

        if (drawn)
          throw new SceneError(
            `<Tex> can't draw ${JSON.stringify(drawn)} in ${quoted}: the TeX font has no glyph for it.`,
            "Write it with a TeX command, or leave it out.",
          );
      } else if (kind === "path") {
        const d = adaptor.getAttribute(node, "d");

        if (!d) continue;
        const code = parseInt(adaptor.getAttribute(node, "data-c") ?? "", 16);
        const char = Number.isNaN(code) ? "path" : String.fromCodePoint(code).normalize("NFKC");

        mark(char, parsePath(d, quoted));
      } else if (kind === "rect") {
        if (adaptor.getAttribute(node, "data-hitbox") !== undefined) continue;
        mark("rule", rectRings(node));
      } else if (kind === "line") mark("rule", [lineRing(node)]);
      else
        throw new SceneError(
          `<Tex> can't draw ${quoted}: it holds a shape (${kind}) it has no outline for.`,
          "Write it without that command.",
        );
    }
  };

  walk(svg, { matrix: identity, parts: [] });

  return { box: [view[0]!, view[1]!, view[2]!, view[3]!], marks };
}
