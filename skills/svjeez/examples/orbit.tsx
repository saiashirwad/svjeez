/** @jsxImportSource svjeez */
import { ease, motion, render, sampled, wiggle } from "svjeez";

const D = 6;
const R = 70;

// sampled() bakes any function of time; the tolerance keeps the keyframe count small.
const moon = sampled((t) => ({ x: R * Math.cos((2 * Math.PI * t) / D), y: 0.4 * R * Math.sin((2 * Math.PI * t) / D) }), {
  duration: D,
  tolerance: { translate: 0.5 },
});

export default function build(): string {
  return render(
    { width: 240, height: 160, duration: D, title: "Orbit", desc: "A moon circles a wobbling planet while a ring spins." },
    <>
      <rect width={240} height={160} fill="#0B0D12" />
      <g transform="translate(120 80)">
        <ellipse rx={R} ry={0.4 * R} fill="none" stroke="#2A2F3D" strokeDasharray="3 5" />
        <circle r={26} fill="#FF5FA8" animation={wiggle({ scale: 0.04 }, { seed: "planet", rate: 3 })} />
        <rect x={-34} y={-2} width={68} height={4} rx={2} fill="#FFD166" animation={motion({ rotate: 0 }).to({ rotate: 360 }, 3, ease.linear).loop(3)} />
        <circle r={7} fill="#3EE6D6" animation={moon} />
      </g>
    </>,
  );
}
