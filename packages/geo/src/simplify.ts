export const simplifyPoints = <Point>(
  points: readonly Point[],
  epsilon: number,
  distanceFrom: (from: Point, to: Point) => (point: Point) => number,
): Point[] => {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  const stack: [number, number][] = [[0, points.length - 1]];
  keep[0] = keep[points.length - 1] = 1;

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const distance = distanceFrom(points[first]!, points[last]!);
    let far = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const score = distance(points[i]!);

      if (score > far) [far, index] = [score, i];
    }

    if (far > epsilon) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
};
