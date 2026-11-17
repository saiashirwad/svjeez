/** Call `tick` once a frame with the seconds since the last one, capped so a hidden tab does not leap on return. */
export const everyFrame = (tick: (dt: number) => void): void => {
  let last = performance.now();

  const frame = (now: number): void => {
    tick(Math.min(0.05, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};
