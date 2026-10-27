import { ease, motion, render } from "svjeez";
import { CSS, theme } from "./kit";

export default function build(): string {
  return render(
    { width: 200, height: 120, duration: 5, title: "Motion", desc: "A square fades in, holds, then shrinks away and cuts back to full size.", css: CSS, reducedMotion: { at: 2 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <rect
        x={76}
        y={36}
        width={48}
        height={48}
        rx={8}
        fill={theme.base0D}
        animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 0.5).wait(2).to({ opacity: 0, scale: 0.8 }, 0.4, ease.in).set({ scale: 1 })}
      />
    </>,
  );
}
