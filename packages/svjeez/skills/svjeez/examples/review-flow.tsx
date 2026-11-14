/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import { render, adaptive, draw, enter, flow, systemDark, systemLight } from "svjeez";

const { theme, css: colors } = adaptive({ dark: systemDark, light: systemLight });
const css = `${colors}\n.sans text{font-family:system-ui,sans-serif}`;
const [M, W, H, GAP] = [24, 96, 40, 40];

const steps = ["git push", "Run CI", "Green?", "Deploy"];
const x = (i: number) => M + i * (W + GAP);
const y = M + H / 2;

// The comet runs a list of points. Here they are the box centers, left to right.
const trip = flow(
  steps.map((_, i) => ({ x: x(i) + W / 2, y })),
  { at: 2.6, style: "comet", arrive: true, color: theme.base09 },
);

export default function build(): string {
  return render(
    {
      width: x(steps.length) - GAP + M,
      height: H + 2 * M,
      duration: Math.ceil(trip.end) + 2,
      title: "Deploy flow",
      desc: "Four steps appear one after another, then a comet runs from push to deploy.",
      css,
      reducedMotion: { at: trip.end },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {steps.slice(1).map((_, i) => (
        <path
          d={`M${x(i) + W} ${y}H${x(i + 1)}`}
          stroke={theme.base03}
          strokeWidth={1.5}
          animation={draw({ at: 0.6 + i * 0.4, over: 0.3 })}
        />
      ))}
      {steps.map((label, i) => (
        <g class="sans" animation={enter({ at: 0.4 + i * 0.4, over: 0.4 })}>
          <rect
            x={x(i)}
            y={M}
            width={W}
            height={H}
            rx={8}
            fill={theme.base01}
            stroke={theme.base03}
          />
          <text
            x={x(i) + W / 2}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fill={theme.base05}
          >
            {label}
          </text>
        </g>
      ))}
      {trip.node}
    </>,
  );
}
