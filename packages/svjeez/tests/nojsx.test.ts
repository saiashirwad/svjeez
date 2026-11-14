import { describe, expect, test } from "bun:test";
import {
  draw,
  ease,
  enter,
  motion,
  render,
  shake,
  adaptive,
  flow,
  systemDark,
  systemLight,
} from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import type { Child, Props } from "../src/svg";
import jsxReview from "../skills/svjeez/examples/review-flow";
import jsxToast from "../skills/svjeez/examples/toast";

type Tag = (props?: Props, content?: Child) => ReturnType<typeof jsx>;

const tag =
  (name: string): Tag =>
  (props = {}, content) =>
    jsx(name, { ...props, children: content });

const el = {
  rect: tag("rect"),
  g: tag("g"),
  circle: tag("circle"),
  path: tag("path"),
  text: tag("text"),
};

const toast = (): string => {
  const { rect, g, circle, path, text } = el;

  return render(
    {
      width: 320,
      height: 120,
      duration: 5,
      title: "Saved",
      desc: "A toast slides in, a check mark draws, then the toast leaves.",
      reducedMotion: { at: 2 },
    },
    [
      rect({ width: 320, height: 120, fill: "#111318" }),
      g(
        {
          animation: motion({ opacity: 0, y: 24 })
            .at(0.3)
            .to({ opacity: 1, y: 0 }, 0.5, ease.pop)
            .at(4)
            .to({ opacity: 0, y: -12 }, 0.4, ease.in),
        },
        [
          rect({
            x: 40,
            y: 34,
            width: 240,
            height: 52,
            rx: 12,
            fill: "#1E2230",
            stroke: "#3EE6D6",
            strokeOpacity: 0.4,
          }),
          circle({
            cx: 68,
            cy: 60,
            r: 14,
            fill: "#3EE6D6",
            animation: [
              enter({ at: 0.6, over: 0.3 }, { scale: 0 }, ease.pop),
              shake({ at: 1.6, over: 0.4 }, { rotate: 12 }),
            ],
          }),
          path({
            d: "M61 60l5 5 9-10",
            fill: "none",
            stroke: "#111318",
            strokeWidth: 3,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            animation: draw({ at: 0.9, over: 0.4 }),
          }),
          text(
            {
              x: 96,
              y: 66,
              fontFamily: "system-ui, sans-serif",
              fontSize: 16,
              fill: "#E6E8EE",
              animation: enter({ at: 0.9, over: 0.5 }, { x: -8 }),
            },
            "Changes saved",
          ),
        ],
      ),
    ],
  );
};

const review = (): string => {
  const { theme, css: colors } = adaptive({ dark: systemDark, light: systemLight });
  const css = `${colors}\n.sans text{font-family:system-ui,sans-serif}`;
  const [M, W, H, GAP] = [24, 96, 40, 40];
  const steps = ["git push", "Run CI", "Green?", "Deploy"];
  const x = (i: number) => M + i * (W + GAP);
  const y = M + H / 2;

  const trip = flow(
    steps.map((_, i) => ({ x: x(i) + W / 2, y })),
    { at: 2.6, style: "comet", arrive: true, color: theme.base09 },
  );

  return render(
    {
      width: x(steps.length) - GAP + M,
      height: H + 2 * M,
      duration: Math.ceil(trip.span.end) + 2,
      title: "Deploy flow",
      desc: "Four steps appear one after another, then a comet runs from push to deploy.",
      css,
      reducedMotion: { at: trip.span.end },
    },
    [
      el.rect({ width: "100%", height: "100%", fill: theme.base00 }),
      steps.slice(1).map((_, i) =>
        el.path({
          d: `M${x(i) + W} ${y}H${x(i + 1)}`,
          stroke: theme.base03,
          strokeWidth: 1.5,
          animation: draw({ at: 0.6 + i * 0.4, over: 0.3 }),
        }),
      ),
      steps.map((label, i) =>
        el.g({ class: "sans", animation: enter({ at: 0.4 + i * 0.4, over: 0.4 }) }, [
          el.rect({
            x: x(i),
            y: M,
            width: W,
            height: H,
            rx: 8,
            fill: theme.base01,
            stroke: theme.base03,
          }),
          el.text(
            {
              x: x(i) + W / 2,
              y,
              textAnchor: "middle",
              dominantBaseline: "central",
              fontSize: 13,
              fill: theme.base05,
            },
            label,
          ),
        ]),
      ),
      trip.node,
    ],
  );
};

describe("building scenes with jsx() instead of JSX syntax", () => {
  test("the toast renders the same bytes", () => {
    expect(toast()).toBe(jsxToast());
  });

  test("the review flow renders the same bytes, with arrays as fragments", () => {
    expect(review()).toBe(jsxReview());
  });
});
