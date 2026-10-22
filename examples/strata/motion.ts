import { anim, drawWindow, frame, revealWindow, type AnimationRequest, type Frame } from "svg-motion";

export const D = 26;

const COPY = [
  { in: [0.42, 0.88] as [number, number], out: [4.2, 4.42] as [number, number] },
  { in: [4.47, 4.91] as [number, number], out: [9.05, 9.23] as [number, number] },
  { in: [9.31, 9.72] as [number, number], out: [14.25, 14.43] as [number, number] },
  { in: [14.5, 14.92] as [number, number], out: [19.45, 19.63] as [number, number] },
  { in: [19.71, 20.12] as [number, number], out: [23.61, 23.79] as [number, number] },
  { in: [23.87, 24.23] as [number, number], out: [25.77, 25.95] as [number, number] },
];

export const copyAnimation = (index: number): AnimationRequest => {
  const window = COPY[index];
  if (!window) throw new Error(`No copy window at ${index}.`);
  return anim(`copy-${index}`, revealWindow({
    in: window.in,
    out: window.out,
    from: { opacity: 0, y: 7 },
    to: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: index === 5 ? 0 : -4 },
  }));
};

const TICKS = [
  { in: undefined, out: [4.2, 4.42] as [number, number] },
  { in: [4.52, 4.78] as [number, number], out: [9.05, 9.25] as [number, number] },
  { in: [9.4, 9.6] as [number, number], out: [14.25, 14.45] as [number, number] },
  { in: [14.6, 14.8] as [number, number], out: [19.45, 19.65] as [number, number] },
  { in: [19.8, 20.0] as [number, number], out: [23.61, 23.81] as [number, number] },
  { in: [23.96, 24.16] as [number, number], out: [25.9, 26] as [number, number] },
];

export const tickAnimation = (index: number): AnimationRequest => {
  const window = TICKS[index];
  if (!window) throw new Error(`No tick window at ${index}.`);
  return anim(`tick-${index}`, revealWindow({
    ...(window.in ? { in: window.in } : {}),
    out: window.out,
    from: { opacity: 0 },
    to: { opacity: 1 },
    exit: { opacity: 0 },
  }));
};

export const INDEX_ACTIVE = [
  { in: [4.84, 5.04] as [number, number], out: [9.0, 9.2] as [number, number] },
  { in: [9.36, 9.56] as [number, number], out: [14.3, 14.5] as [number, number] },
  { in: [14.56, 14.76] as [number, number], out: [19.5, 19.7] as [number, number] },
  { in: [19.76, 19.96] as [number, number], out: [23.82, 24.02] as [number, number] },
];

export const activeAnimation = (index: number): AnimationRequest => {
  const window = INDEX_ACTIVE[index];
  if (!window) throw new Error(`No index window at ${index}.`);
  return anim(`active-${index}`, revealWindow({
    in: window.in,
    out: window.out,
    from: { opacity: 0 },
    to: { opacity: 1 },
    exit: { opacity: 0 },
  }));
};

export const buildAnimation = (index: number): AnimationRequest =>
  anim(`build-${index}`, revealWindow({
    in: [0.8 + index * 0.12, 1.25 + index * 0.12],
    from: { opacity: 0, y: 6 },
    to: { opacity: 1, y: 0 },
  }));

export const fadeAnimation = (
  name: string,
  inWindow: [number, number],
  outWindow?: [number, number],
): AnimationRequest =>
  anim(name, revealWindow({
    in: inWindow,
    ...(outWindow ? { out: outWindow } : {}),
    from: { opacity: 0 },
    to: { opacity: 1 },
    exit: { opacity: 0 },
  }));

export const riseAnimation = (
  name: string,
  inWindow: [number, number],
  outWindow: [number, number] | undefined,
  y = 6,
): AnimationRequest =>
  anim(name, revealWindow({
    in: inWindow,
    ...(outWindow ? { out: outWindow } : {}),
    from: { opacity: 0, y },
    to: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 0 },
  }));

export const drawAnimation = (
  name: string,
  inWindow: [number, number],
  outWindow?: [number, number],
  opacity = 1,
): AnimationRequest => anim(name, drawWindow({ in: inWindow, ...(outWindow ? { out: outWindow } : {}), opacity }));

export const presenceAnimation = (index: number): AnimationRequest => {
  const windows: Array<[number, number, number]> = [
    [19.66, 19.9, 20.4],
    [19.9, 20.14, 20.64],
    [20.14, 20.38, 20.88],
  ];
  const window = windows[index];
  if (!window) throw new Error(`No presence window at ${index}.`);
  const frames: Frame[] = [
    frame(0, { opacity: 0.4 }),
    frame(window[0], { opacity: 0.4 }),
    frame(window[1], { opacity: 0.95 }),
    frame(window[2], { opacity: 0.4 }),
  ];
  return anim(`presence-${index}`, frames);
};
