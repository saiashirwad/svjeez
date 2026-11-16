// The geometry and the kinematics of a Swiss lever escapement, with no drawing in it. The balance swings as a sine of
// the beat count, its impulse pin carries the fork, and the escape wheel turns as far as the pallets let it: its angle
// is found by testing the teeth against the two stones, so lock, impulse and drop come out of the shapes.

export type P = readonly [number, number];

const RAD = Math.PI / 180;

/** A point at radius r, a degrees clockwise from straight up. */
export const polar = (r: number, a: number): P => [r * Math.sin(a * RAD), -r * Math.cos(a * RAD)];

export const turn = ([x, y]: P, deg: number, [cx, cy]: P = [0, 0]): P => {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);

  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};

/** Teeth on the escape wheel, and the angle from one to the next. */
export const TEETH = 15;
export const PITCH = 360 / TEETH;

/** The radius the heel of a tooth sweeps. Everything here is drawn around the escape wheel's center. */
export const R = 60;
const TOE = R - 2.6;

/** The fork's pivot sits where the tangents at 30° either side of the line of centers cross. */
export const FORK: P = [0, -R / Math.cos(30 * RAD)];

/** From the fork's pivot to the balance staff. */
export const REACH = 85;
export const BALANCE: P = [0, FORK[1] - REACH];

/** The impulse pin's distance from the balance staff. */
export const PIN = 16.05;

/** The fork banks this far either side of the line of centers. */
export const BANK = 5.5;

/** How far the balance swings each way. */
export const SWING = 250;

/** One tooth in the wheel's frame, pointing up: toe (the locking corner), heel, then down the back and up the front. */
export const tooth: readonly P[] = [
  polar(TOE, 1.6),
  polar(R, -3.2),
  polar(56.5, -6.4),
  polar(48, -8.4),
  polar(42, -14),
  polar(42, -5.5),
  polar(48, -3.4),
];

const stone = (lock: P, letOff: P, lean: number): readonly P[] => {
  const [vx, vy] = polar(17, lean);

  return [lock, letOff, [letOff[0] + vx, letOff[1] + vy], [lock[0] + vx, lock[1] + vy]];
};

/** The two pallet stones with the fork on the line of centers: locking corner, let-off corner, then the body. */
export const entry = stone(polar(59.6, -32.85), polar(57.3, -27.15), -17);
export const exit = stone(polar(59.6, 27.15), polar(57.3, 32.85), 43);

const crosses = (a: P, b: P, c: P, d: P) => {
  const side = (p: P, q: P, r: P) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);

  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

const inside = ([x, y]: P, poly: readonly P[]) => {
  let hit = false;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }

  return hit;
};

const overlap = (a: readonly P[], b: readonly P[]) =>
  a.some((p, i) =>
    b.some((q, j) => crosses(p, a[(i + 1) % a.length]!, q, b[(j + 1) % b.length]!)),
  ) ||
  inside(a[0]!, b) ||
  inside(b[0]!, a);

/** Whether any tooth is inside a stone with the wheel at w degrees and the fork at psi. */
const blocked = (w: number, psi: number) => {
  const stones = [entry, exit].map((s) => s.map((p) => turn(p, psi, FORK)));

  // Only the teeth near the top can reach a stone.
  for (let k = 0; k < TEETH; k++) {
    const at = ((((w + k * PITCH + 180) % 360) + 360) % 360) - 180;

    if (Math.abs(at) > 50) continue;
    const poly = tooth.map((p) => turn(p, w + k * PITCH));

    if (stones.some((s) => overlap(poly, s))) return true;
  }

  return false;
};

/** The balance's angle at a beat count: it crosses the line of centers on every whole beat. */
export const balanceAt = (beat: number) => SWING * Math.sin(Math.PI * beat);

const lift = (theta: number) =>
  Math.atan2(PIN * Math.sin(theta * RAD), REACH - PIN * Math.cos(theta * RAD)) / RAD;

/** Past this angle the pin has left the fork. */
const ENGAGED = (() => {
  let t = 0;

  while (lift(t) < BANK) t += 0.01;

  return t;
})();

/** The fork's angle for a balance angle: the pin carries it across, and it rests on a banking pin otherwise. */
export const forkAt = (theta: number) =>
  Math.abs(theta) >= ENGAGED ? -Math.sign(theta) * BANK : -lift(theta);

/** Samples in the table of two beats, one full swing there and back. */
const N = 8000;

/** The wheel is light but not weightless: free of the stones it turns no faster than this, in degrees per beat. */
const FREE = 900;
const STEP = 0.01;

/** The wheel's angle over two beats, starting half a beat before the tick on the entry stone. It gains one tooth. */
const table = (() => {
  let w = -40;
  const out: number[] = [];

  const settle = (psi: number, most: number) => {
    let back = 0;

    while (blocked(w, psi) && back++ < 2000) w -= STEP;
    let moved = 0;

    while (moved + STEP <= most && !blocked(w + STEP, psi)) {
      w += STEP;
      moved += STEP;
    }
  };

  // Two beats to settle from wherever it starts, then the two that are kept.
  for (let i = -N; i <= N; i++) {
    const beat = 0.5 + (i / N) * 2;
    settle(forkAt(balanceAt(beat)), i === -N ? 60 : (FREE * 2) / N);

    if (i >= 0) out.push(w);
  }

  return out;
})();

/** How far the wheel has turned by a beat count, in degrees. Beat 1 is a tick on the entry stone, beat 2 on the exit. */
export const wheelAt = (beat: number) => {
  const turns = Math.floor((beat - 0.5) / 2);
  const at = ((beat - 0.5 - turns * 2) / 2) * N;
  const i = Math.min(N - 1, Math.floor(at));
  const span = table[N]! - table[0]!;

  return table[i]! + (table[i + 1]! - table[i]!) * (at - i) + turns * span - table[0]!;
};

/** The wheel's angle at beat 0.5, which the drawing starts from. */
export const WHEEL0 = table[0]!;

/** What two beats turn the wheel by: one tooth, if the escapement works. */
export const GAIN = table[N]! - table[0]!;
