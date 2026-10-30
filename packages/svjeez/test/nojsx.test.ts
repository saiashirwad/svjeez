import { describe, expect, test } from "bun:test";
import { draw, ease, el, enter, motion, render, shake } from "svjeez";
import { adaptive, flow, flowchart, systemDark, systemLight } from "svjeez/extras";
import jsxReview from "../skills/svjeez/examples/review-flow";
import jsxToast from "../skills/svjeez/examples/toast";

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
  const M = 24;

  const chart = flowchart(
    {
      nodes: {
        push: { label: "git push", role: "input" },
        ci: { label: "Run CI", role: "tool" },
        green: { label: "Green?", role: "decision" },
        ship: { label: "Deploy", role: "output" },
      },
      edges: [
        ["push", "ci"],
        ["ci", "green"],
        ["green", "ship", { label: "yes" }],
        ["green", "ci", { label: "retry" }],
      ],
    },
    { theme, x: M, y: M, fontSize: 13, class: "sans", play: { at: 0.4, step: 0.4 } },
  );

  const trip = flow(chart.route("push", "ship"), {
    at: 2.6,
    style: "comet",
    arrive: true,
    color: theme.base09,
  });

  return render(
    {
      width: chart.bounds.w + 2 * M,
      height: chart.bounds.h + 2 * M,
      duration: Math.ceil(trip.end) + 2,
      title: "Deploy flow",
      desc: "A CI flowchart revealed rank by rank, then a comet runs from push to deploy.",
      css,
      reducedMotion: { at: trip.end },
    },
    [
      el.rect({ width: "100%", height: "100%", fill: theme.base00 }),
      chart.layers.under,
      trip.node,
      chart.layers.over,
    ],
  );
};

describe("building scenes with el instead of JSX", () => {
  test("the toast renders the same bytes", () => {
    expect(toast()).toBe(jsxToast());
  });

  test("the review flow renders the same bytes, with arrays as fragments", () => {
    expect(review()).toBe(jsxReview());
  });
});
