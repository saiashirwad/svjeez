import { render, type Child } from "svjeez";

export const scene = (child: Child) =>
  render({ width: 200, height: 100, duration: 2, title: "Ink" }, child);

/** Width of an outline across its middle, measured perpendicular to a horizontal stroke. */
export const thickness = (d: string, x: number): number => {
  const ys: number[] = [];
  let [px, py] = [0, 0];

  for (const [, cmd, args] of d.matchAll(/([MlLqZ])([^MlLqZ]*)/g)) {
    const n = (args!.match(/-?\d*\.?\d+/g) ?? []).map(Number);

    const visit = (nx: number, ny: number) => {
      [px, py] = [nx, ny];

      if (Math.abs(px - x) < 1) ys.push(py);
    };

    if (cmd === "M" || cmd === "L") visit(n[0]!, n[1]!);
    else if (cmd === "l") for (let i = 0; i < n.length; i += 2) visit(px + n[i]!, py + n[i + 1]!);
    else if (cmd === "q") visit(px + n[2]!, py + n[3]!);
  }

  return Math.max(...ys) - Math.min(...ys);
};
