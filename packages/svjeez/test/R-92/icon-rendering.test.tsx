import { describe, expect, test } from "bun:test";
import { draw, Icon, render, type Child, type IconData } from "svjeez";

const scene = (child: Child) =>
  render({ width: 100, height: 100, duration: 2, title: "Icon" }, child);

const body = (svg: string) => svg.slice(Math.max(0, svg.indexOf("</style>")));

const arrow: IconData = {
  grid: 24,
  kind: "stroke",
  paths: ["M5 12h14", "M13 6l6 6l-6 6"],
};

const dot: IconData = { grid: 16, kind: "fill", paths: ["M8 4a4 4 0 1 0 0 8a4 4 0 1 0 0 -8"] };

describe("Icon", () => {
  test("a stroke icon is stroked with rounded ends and no fill, on a group scaled to its size", () => {
    const svg = body(scene(<Icon icon={arrow} x={10} y={20} size={48} stroke="#fff" />));

    expect(svg).toContain('transform="translate(10 20) scale(2)"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#fff"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg.match(/<path /g)).toHaveLength(2);
  });

  test("the stroke defaults to currentColor and its width is in grid units", () => {
    const svg = body(scene(<Icon icon={arrow} strokeWidth={1.5} />));

    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('stroke-width="1.5"');
  });

  test("an icon drawn at its own grid at the origin has no transform", () => {
    expect(body(scene(<Icon icon={arrow} />))).not.toContain("transform=");
  });

  test("a fill icon is filled, never stroked", () => {
    const svg = body(
      scene(<Icon icon={dot} size={32} fill="#e33" stroke="#000" strokeWidth={4} />),
    );

    expect(svg).toContain('fill="#e33"');
    expect(svg).toContain('transform="scale(2)"');
    expect(svg).not.toContain("stroke");
  });

  test("a fill icon defaults to currentColor", () => {
    expect(body(scene(<Icon icon={dot} />))).toContain('fill="currentColor"');
  });

  test("an alt makes it an image, and without one it is hidden from assistive tech", () => {
    const labelled = body(scene(<Icon icon={arrow} alt="Next" />));
    const hidden = body(scene(<Icon icon={arrow} />));

    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Next"');
    expect(labelled).not.toContain("aria-hidden");
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toMatch(/<g [^>]*role=/);
  });

  test("a function animation runs per path, so pieces draw one after another", () => {
    const svg = scene(
      <Icon icon={arrow} animation={(_, i) => draw({ at: 0.2 + i * 0.5, over: 0.5 })} />,
    );

    expect(svg.match(/<path [^>]*pathLength="1"/g)).toHaveLength(2);
    expect(svg.match(/@keyframes/g)).toHaveLength(2);
  });

  test("one stack animates every path", () => {
    const svg = scene(<Icon icon={arrow} animation={draw({ at: 0, over: 1 })} />);

    expect(svg.match(/<path [^>]*pathLength="1"/g)).toHaveLength(2);
    expect(svg.match(/@keyframes/g)).toHaveLength(1);
  });

  test("a path keeps drawing from its start under the scaled group", () => {
    const svg = scene(<Icon icon={arrow} size={96} animation={draw({ at: 0, over: 1 })} />);

    expect(svg).toContain('transform="scale(4)"');
    expect(svg).toContain('pathLength="1"');
    expect(svg).toContain("stroke-dasharray");
  });
});
