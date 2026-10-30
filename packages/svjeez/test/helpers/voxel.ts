import { render } from "svjeez";
import { voxel, type Vec3, type VoxelBlock } from "svjeez/voxel";

export const DURATION = 10;
export const camera = voxel.camera({ yaw: 45, pitch: 30, unit: 10 });
export const solid = (color: `#${string}`) => voxel.texture({ x: color }, "x");
export const [red, green, blue] = [solid("#ff0000"), solid("#00ff00"), solid("#0000ff")];

export const build = (blocks: readonly VoxelBlock[]) =>
  render(
    { width: 200, height: 200, duration: DURATION, title: "Test" },
    voxel.scene({ camera, blocks }),
  );

export const place = (at: Vec3, extra: Partial<VoxelBlock> = {}): VoxelBlock => ({
  at,
  skin: red,
  ...extra,
});

export const uses = (svg: string) =>
  [
    ...svg
      .slice(svg.indexOf("<g>"))
      .matchAll(/<use href="#(\w+)" x="([^"]+)" y="([^"]+)"(?: class="([^"]+)")?/g),
  ].map(([, href, x, y, cls]) => ({
    href: href!,
    x: Number(x),
    y: Number(y),
    cls,
  }));

export const topColor = (svg: string, href: string): string => {
  const symbol = svg.match(new RegExp(`<symbol id="${href}"[^>]*>([\\s\\S]*?)</symbol>`))![1]!;
  const top = [...symbol.matchAll(/href="#(\w+)"/g)].at(-1)![1]!;

  return svg.match(new RegExp(`<symbol id="${top}"[^>]*>\\s*<rect[^>]*fill="(#\\w+)"`))![1]!;
};

export const cellAt = (cells: readonly Vec3[]) => (use: { x: number; y: number }) =>
  cells.find(
    (cell) =>
      Math.abs(camera.project(cell).x - use.x) < 0.01 &&
      Math.abs(camera.project(cell).y - use.y) < 0.01,
  );

export const presenceAt = (svg: string, cls: string, t: number): number => {
  const name = svg.match(new RegExp(`\\.${cls.split(" ").at(-1)}\\{animation-name:([\\w-]+)`))![1]!;
  const body = svg.match(new RegExp(`@keyframes ${name}\\{(.*)\\}$`, "m"))![1]!;

  const keys = [...body.matchAll(/([\d.%,]+)\{visibility:(hidden|visible)\}/g)].flatMap(
    ([, percents, value]) =>
      percents!.split(",").map((percent) => ({
        at: (parseFloat(percent) / 100) * DURATION,
        value: value === "visible" ? 1 : 0,
      })),
  );

  return keys
    .filter((key) => key.at <= t)
    .sort((a, b) => a.at - b.at)
    .at(-1)!.value;
};
