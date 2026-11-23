import { Result } from "effect";
import type { IconData } from "../src/icon.tsx";

export const exportName = (file: string): string => {
  const camel = file
    .replace(/(?<=\d)-(?=\d)/g, "_")
    .replace(/-+([a-z0-9])/g, (_, c: string) => c.toUpperCase());

  return /^[A-Za-z_$][\w$]*$/.test(camel) &&
    !/^(arguments|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|eval|export|extends|false|finally|for|function|if|implements|import|in|instanceof|interface|let|new|null|package|private|protected|public|return|static|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|undefined|NaN|Infinity)$/.test(
      camel,
    )
    ? camel
    : `icon${camel[0]!.toUpperCase()}${camel.slice(1)}`;
};

const num = (value: number): string => String(Math.round(value * 1000) / 1000);

const attributes = (source: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Array.from(source.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g), ([, name, value]) => [name!, value!]),
  );

const GEOMETRY = new Map([
  ["path", ["d"]],
  ["circle", ["cx", "cy", "r"]],
  ["ellipse", ["cx", "cy", "rx", "ry"]],
  ["rect", ["x", "y", "width", "height", "rx", "ry"]],
  ["line", ["x1", "y1", "x2", "y2"]],
  ["polyline", ["points"]],
  ["polygon", ["points"]],
]);

export const parse = (
  file: string,
  svg: string,
  kind: IconData["kind"],
): Result.Result<IconData, string> =>
  Result.gen(function* () {
    const clean = svg.replace(/<!--[\s\S]*?-->/g, "");
    const root = yield* Result.fromNullishOr(clean.match(/<svg\b([^>]*)>/), () => "no <svg>");
    const rootAttrs = attributes(root[1]!);
    const box = (rootAttrs.viewBox ?? "").split(/\s+/).map(Number);

    if (box.length !== 4 || box[0] !== 0 || box[1] !== 0 || box[2] !== box[3] || !(box[2]! > 0))
      return yield* Result.fail(`viewBox "${rootAttrs.viewBox}" is not a square from the origin`);

    for (const [name, value] of Object.entries(
      kind === "solid" ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor" },
    ))
      if (rootAttrs[name] !== value)
        return yield* Result.fail(`<svg> ${name} is "${rootAttrs[name]}"`);

    if (kind === "outline" && rootAttrs["stroke-width"] !== "2")
      return yield* Result.fail(`stroke-width is "${rootAttrs["stroke-width"]}"`);

    const paths = (yield* Result.all(
      Array.from(
        clean.slice(clean.indexOf(">", root.index) + 1).matchAll(/<([a-zA-Z]+)\b([^>]*?)\/?>/g),
        ([, tag, source]) =>
          Result.gen(function* () {
            const attrs = attributes(source!);

            const geometry = yield* Result.fromNullishOr(
              GEOMETRY.get(tag!),
              () => `unknown element <${tag}>`,
            );

            const allowed = [
              ...geometry,
              "fill",
              "stroke",
              ...(file === "brand-parsinta" ? ["opacity"] : []),
            ];

            const stray = Object.keys(attrs).filter((name) => !allowed.includes(name));

            if (stray.length) return yield* Result.fail(`<${tag}> has ${stray.join(", ")}`);

            if (attrs.stroke === "none" && attrs.fill === "none") return [];

            const a = (name: string, fallback?: number) =>
              Result.liftPredicate(
                Number(attrs[name] ?? fallback),
                (value) => !Number.isNaN(value),
                () => `<${tag}> needs a number ${name}`,
              );

            switch (tag) {
              case "circle": {
                const [cx, cy, r] = [yield* a("cx", 0), yield* a("cy", 0), yield* a("r")];

                return [
                  `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0`,
                ];
              }

              case "ellipse": {
                const [cx, cy, rx, ry] = [
                  yield* a("cx", 0),
                  yield* a("cy", 0),
                  yield* a("rx"),
                  yield* a("ry"),
                ];

                return [
                  `M${num(cx - rx)} ${num(cy)}a${num(rx)} ${num(ry)} 0 1 0 ${num(2 * rx)} 0a${num(rx)} ${num(ry)} 0 1 0 ${num(-2 * rx)} 0`,
                ];
              }

              case "rect": {
                const [x, y, w, h] = [
                  yield* a("x", 0),
                  yield* a("y", 0),
                  yield* a("width"),
                  yield* a("height"),
                ];

                const rx = Math.min(yield* a("rx", yield* a("ry", 0)), w / 2);
                const ry = Math.min(yield* a("ry", yield* a("rx", 0)), h / 2);

                if (rx === 0 || ry === 0)
                  return [`M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`];

                const corner = (dx: number, dy: number) =>
                  `a${num(rx)} ${num(ry)} 0 0 1 ${num(dx)} ${num(dy)}`;

                return [
                  `M${num(x + rx)} ${num(y)}h${num(w - 2 * rx)}${corner(rx, ry)}v${num(h - 2 * ry)}${corner(-rx, ry)}` +
                    `h${num(2 * rx - w)}${corner(-rx, -ry)}v${num(2 * ry - h)}${corner(rx, -ry)}z`,
                ];
              }

              case "line":
                return [
                  `M${num(yield* a("x1", 0))} ${num(yield* a("y1", 0))}L${num(yield* a("x2", 0))} ${num(yield* a("y2", 0))}`,
                ];

              case "polyline":
              case "polygon": {
                const n = (attrs.points ?? "")
                  .trim()
                  .split(/[\s,]+/)
                  .map(Number);

                if (n.length % 2 || n.some(Number.isNaN))
                  return yield* Result.fail(`bad points "${attrs.points}"`);

                const d = Array.from(
                  { length: n.length / 2 },
                  (_, i) => `${i ? "L" : "M"}${num(n[2 * i]!)} ${num(n[2 * i + 1]!)}`,
                ).join("");

                return [tag === "polygon" ? `${d}z` : d];
              }

              default:
                return [yield* Result.fromNullishOr(attrs.d, () => "<path> has no d")];
            }
          }),
      ),
    )).flat();

    if (!paths.length) return yield* Result.fail("no paths");

    return { grid: box[2]!, kind, paths };
  });
