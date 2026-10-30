import { Once, ease, motion, render } from "svjeez";

export const scene = (content: Parameters<typeof render>[1], prefix?: string) =>
  render({ width: 20, height: 20, duration: 4, title: "Once", prefix }, content);

export const fade = () => motion({ opacity: 0 }).to({ opacity: 1 }, 1, ease.linear);

const blur = () => motion({ blur: 0 }).to({ blur: 4 }, 2, ease.linear);

export const smilScene = () =>
  scene(
    <>
      <rect width={5} height={5} animation={blur()} />
      <Once>
        <rect width={5} height={5} animation={blur()} />
      </Once>
    </>,
  );
