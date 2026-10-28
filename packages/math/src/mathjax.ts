import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { identity, multiply, parseTransform, round, type Matrix } from "./matrix.ts";
import { boxPath, holePath } from "./path.ts";

/** One filled mark of a formula, in MathJax's units: 1000 to the em, y up before `matrix` flips it. */
export interface Mark {
  /** The character of a glyph, NFKC-normalized; `rect` or `line` for a drawn bar. */
  readonly char: string;
  /** What decides whether two marks are the same drawing: the character, or a bar's size. */
  readonly key: string;
  readonly d: string;
  /** Glyph units to the SVG user space of the formula, including MathJax's flip. */
  readonly matrix: Matrix;
  /** Product of the nested `scale()`s: 0.707 for a superscript. */
  readonly size: number;
  readonly fill?: string;
  readonly id?: string;
}

export interface Compiled {
  /** The SVG viewBox: the formula's box in user space. */
  readonly box: readonly [x: number, y: number, w: number, h: number];
  readonly marks: readonly Mark[];
}

/** `noundefined` paints an unknown macro red and `noerrors` hides errors, and both turn a typo into a silent picture. */
const PACKAGES = AllPackages.filter((name) => name !== "noundefined" && name !== "noerrors");

const adaptor = liteAdaptor();

type Node = LiteElement;

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

interface Inherited {
  readonly matrix: Matrix;
  readonly fill?: string;
  readonly id?: string;
}

const num = (node: Node, name: string): number => Number(adaptor.getAttribute(node, name) ?? 0);

interface Outline {
  readonly d: string;
  readonly key: string;
}

/** A stroked rectangle or line has no outline in the SVG, so it becomes the outline's own mark. */
function stroked(kind: "rect" | "line", node: Node): Outline {
  const width = num(node, "stroke-width");

  if (kind === "line") {
    const [x1, y1, x2, y2] = [num(node, "x1"), num(node, "y1"), num(node, "x2"), num(node, "y2")];
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const [nx, ny] = [((y2 - y1) / length) * (width / 2), ((x1 - x2) / length) * (width / 2)];

    return {
      key: `line:${round(x2 - x1)}x${round(y2 - y1)}`,
      d: `M${round(x1 + nx)} ${round(y1 + ny)}L${round(x2 + nx)} ${round(y2 + ny)}L${round(x2 - nx)} ${round(y2 - ny)}L${round(x1 - nx)} ${round(y1 - ny)}Z`,
    };
  }

  const [x, y, w, h] = [num(node, "x"), num(node, "y"), num(node, "width"), num(node, "height")];
  const half = width / 2;

  return {
    key: `rect:${round(w)}x${round(h)}`,
    d:
      boxPath(x - half, y - half, w + width, h + width) +
      holePath(x + half, y + half, w - width, h - width),
  };
}

/**
 * Typesets `source` with MathJax and reads the SVG back as marks. Throws when MathJax reports a TeX error
 * or draws something this package cannot place, such as a `<text>` fallback for a character the font lacks.
 */
export function compile(source: string, display: boolean): Compiled {
  const container = convert(source, display);
  // SAFETY: MathJax's container holds elements only, and the walk below skips text by its kind.
  const svg = (adaptor.childNodes(container) as Node[]).find((n) => adaptor.kind(n) === "svg");

  if (!svg)
    throw new Error(`tex() got no drawing back from MathJax for ${JSON.stringify(source)}.`);
  const view = (adaptor.getAttribute(svg, "viewBox") ?? "").split(/\s+/).map(Number);
  const [minX, minY, boxW, boxH] = view;

  if (view.length !== 4 || view.some(Number.isNaN))
    throw new Error(
      `tex() could not read the box MathJax drew for ${JSON.stringify(source)}. A \\tag draws a full-width table that has none.`,
    );
  const marks: Mark[] = [];

  const walk = (parent: Node, inherited: Inherited) => {
    // SAFETY: a LiteNode is a LiteElement or a LiteText, and the loop skips text by its kind.
    for (const node of adaptor.childNodes(parent) as Node[]) {
      const kind = adaptor.kind(node);

      if (kind === "#text" || kind === "title") continue;
      const message = adaptor.getAttribute(node, "data-mjx-error");

      if (message !== undefined)
        throw new Error(`tex() could not parse ${JSON.stringify(source)}: ${message}`);
      const own = adaptor.getAttribute(node, "fill");

      const here: Inherited = {
        matrix: multiply(inherited.matrix, parseTransform(adaptor.getAttribute(node, "transform"))),
        fill: own && own !== "none" && own !== "currentColor" ? own : inherited.fill,
        id: adaptor.getAttribute(node, "id") ?? inherited.id,
      };

      if (kind === "g" || kind === "a") walk(node, here);
      else if (kind === "text") {
        const drawn = adaptor.textContent(node).trim();

        if (drawn)
          throw new Error(
            `tex() cannot draw ${JSON.stringify(drawn)} in ${JSON.stringify(source)}: the MathJax font has no glyph for it.`,
          );
      } else if (kind === "path") {
        const d = adaptor.getAttribute(node, "d");

        if (!d) continue;
        const code = parseInt(adaptor.getAttribute(node, "data-c") ?? "", 16);

        const char = Number.isNaN(code) ? "path" : String.fromCodePoint(code).normalize("NFKC");

        marks.push({
          char,
          key: char,
          d,
          matrix: here.matrix,
          size: here.matrix[0],
          fill: here.fill,
          id: here.id,
        });
      } else if (kind === "rect" || kind === "line") {
        if (adaptor.getAttribute(node, "data-hitbox") !== undefined) continue;
        const outlined = own === "none" || kind === "line";

        const [w, h] = [num(node, "width"), num(node, "height")];

        const { d, key }: Outline = outlined
          ? stroked(kind, node)
          : {
              d: boxPath(num(node, "x"), num(node, "y"), w, h),
              key: `rect:${round(w)}x${round(h)}`,
            };

        marks.push({
          char: kind,
          key,
          d,
          matrix: here.matrix,
          size: here.matrix[0],
          fill: here.fill,
          id: here.id,
        });
      } else {
        throw new Error(
          `tex() cannot draw a <${kind}> element in ${JSON.stringify(source)}. MathJax builds stretchy parts such as \\overbrace from clipped pieces.`,
        );
      }
    }
  };

  walk(svg, { matrix: identity });

  return { box: [minX!, minY!, boxW!, boxH!], marks };
}
