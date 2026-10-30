import { describe, expect, test } from "bun:test";
import { Picture, picture, render, validateSvg } from "svjeez";
import { fixtures } from "../helpers/picture-fixtures";

describe("<Picture>", () => {
  const photo = picture(fixtures.png);

  const scene = (node: ReturnType<typeof Picture>) =>
    render({ width: 400, height: 300, duration: 1, title: "Pic" }, node);

  const frame = (svg: string) =>
    /<rect x="[^"]*" y="[^"]*" width="([^"]*)" height="([^"]*)"/.exec(svg)?.slice(1).map(Number);

  test("derives the missing side from the aspect ratio, and defaults to intrinsic size", () => {
    expect(frame(scene(<Picture src={photo} x={0} y={0} width={150} />))).toEqual([150, 100]);
    expect(frame(scene(<Picture src={photo} x={0} y={0} height={50} />))).toEqual([75, 50]);
    expect(frame(scene(<Picture src={photo} x={0} y={0} />))).toEqual([300, 200]);
    expect(scene(<Picture src={photo} width={150} />)).toBe(
      scene(<Picture src={photo} x={0} y={0} width={150} />),
    );
  });

  test("fit scales and centers the image in its frame, defaulting to cover", () => {
    expect(scene(<Picture src={photo} x={10} y={10} width={100} height={100} />)).toContain(
      'transform="translate(-15 10) scale(0.5 0.5)"',
    );
    expect(
      scene(<Picture src={photo} x={10} y={10} width={100} height={100} fit="contain" />),
    ).toContain('transform="translate(10 26.6667) scale(0.333333 0.333333)"');
    expect(
      scene(<Picture src={photo} x={10} y={10} width={100} height={100} fit="fill" />),
    ).toContain('transform="translate(10 10) scale(0.333333 0.5)"');
  });

  test("cover and radius clip to the frame; contain and fill need no clip", () => {
    const rounded = scene(
      <Picture src={photo} x={10} y={20} width={100} height={60} radius={12} />,
    );

    expect(rounded).toMatch(
      /<clipPath[^>]*>\s*<rect x="10" y="20" width="100" height="60" rx="12"/,
    );
    expect(scene(<Picture src={photo} x={0} y={0} fit="contain" />)).not.toContain("clipPath");
  });

  test("a picture drawn many times embeds its bytes once", () => {
    const svg = scene(
      <>
        <Picture src={photo} x={0} y={0} />
        <Picture src={photo} x={100} y={0} fit="contain" />
        <Picture src={photo} x={200} y={0} fit="fill" radius={8} />
      </>,
    );

    expect(svg.split(photo.href).length - 1).toBe(1);
  });

  test("alt labels the picture, and no alt hides it", () => {
    expect(scene(<Picture src={photo} x={0} y={0} alt="A harbor" />)).toContain(
      'role="img" aria-label="A harbor"',
    );
    expect(scene(<Picture src={photo} x={0} y={0} />)).toContain('aria-hidden="true"');
  });

  test("the output validates, including a data URI image", () => {
    expect(validateSvg(scene(<Picture src={photo} x={0} y={0} radius={4} />)).errors).toEqual([]);
  });
});
