export interface Point { readonly x: number; readonly y: number }
export interface Rect {
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly top: Point; readonly bottom: Point; readonly left: Point; readonly right: Point; readonly center: Point;
  pad(n: number): Rect;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x, y, w, h,
  top: { x: x + w / 2, y }, bottom: { x: x + w / 2, y: y + h },
  left: { x, y: y + h / 2 }, right: { x: x + w, y: y + h / 2 },
  center: { x: x + w / 2, y: y + h / 2 },
  pad: (n) => rect(x - n, y - n, w + n * 2, h + n * 2),
});
