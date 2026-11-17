import type { Point } from "svjeez";
import type { Sheet } from "./sheet";
import { createSprite, parseScene, type Sprite } from "./sprite";

/** A rendered scene to play in. It marks its layers with `data-layer`: `ground`, `things` and `effects`. */
export interface Backdrop {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

/** How much of the world the camera shows, in world px. The stage scales it to cover the host. */
export interface View {
  readonly width: number;
  readonly height: number;
}

export interface Stage {
  readonly root: SVGSVGElement;
  /** Seconds since the world began to play: where its clock is now. */
  clock(): number;
  /** Put a sprite among the things at a point. Things are drawn in order of y, so it passes behind whatever stands lower. */
  stand(sprite: Sprite, at: Point): void;
  /** Lay an element flat on the ground, under everything that stands. */
  lay(node: SVGElement): void;
  /** Play a sheet once at a point, above the things, and take it away after `seconds`. */
  flash(effect: Sheet, at: Point, seconds: number): void;
  /** Move the camera toward a point. `dt` is the time since the last call; leave it out to cut. */
  follow(at: Point, dt?: number): void;
  /** The world point under a point of the page. */
  pointAt(clientX: number, clientY: number): Point;
}

interface Movable {
  moveBefore(node: Node, before: Node | null): void;
}

/** `moveBefore` moves a node without restarting its animations. Where it is missing, the walk cycle restarts instead. */
const canMove = (parent: Element): parent is Element & Movable => "moveBefore" in parent;

const baseline = (node: Element | null): number =>
  node instanceof SVGElement ? Number(node.dataset["y"]) : Number.NaN;

const layer = (root: SVGSVGElement, name: string): SVGGElement => {
  const found = root.querySelector<SVGGElement>(`:scope > g[data-layer="${name}"]`);

  if (!found) throw new Error(`The backdrop has no <g data-layer="${name}">.`);

  return found;
};

export const createStage = (host: HTMLElement, backdrop: Backdrop, view: View): Stage => {
  const root = parseScene(backdrop.svg);
  const ground = layer(root, "ground");
  const things = layer(root, "things");
  const effects = layer(root, "effects");
  const began = performance.now();
  let zoom = 1;
  let camera: Point = { x: backdrop.width / 2, y: backdrop.height / 2 };

  root.style.position = "absolute";
  root.style.left = "0";
  root.style.top = "0";
  root.style.transformOrigin = "0 0";
  host.append(root);

  const frame = (): void => {
    const half = { x: host.clientWidth / zoom / 2, y: host.clientHeight / zoom / 2 };

    const x = Math.max(half.x, Math.min(backdrop.width - half.x, camera.x));
    const y = Math.max(half.y, Math.min(backdrop.height - half.y, camera.y));

    root.style.transform = `translate(${((half.x - x) * zoom).toFixed(1)}px, ${((half.y - y) * zoom).toFixed(1)}px)`;
  };

  const fit = (): void => {
    zoom = Math.max(host.clientWidth / view.width, host.clientHeight / view.height);
    root.setAttribute("width", String(backdrop.width * zoom));
    root.setAttribute("height", String(backdrop.height * zoom));
    frame();
  };

  new ResizeObserver(fit).observe(host);
  fit();

  const sort = (node: SVGGElement): void => {
    const y = baseline(node);
    let before = node.nextElementSibling;

    while (before && baseline(before) <= y) before = before.nextElementSibling;

    if (before === node.nextElementSibling) {
      let after = node.previousElementSibling;

      while (after && baseline(after) > y) after = after.previousElementSibling;

      if (after === node.previousElementSibling) return;
      before = after ? after.nextElementSibling : things.firstElementChild;
    }

    if (canMove(things) && node.parentNode === things) things.moveBefore(node, before);
    else things.insertBefore(node, before);
  };

  return {
    root,
    clock: () => (performance.now() - began) / 1000,
    stand(sprite, at) {
      sprite.moveTo(at);
      sprite.node.dataset["y"] = at.y.toFixed(1);

      if (sprite.node.parentNode !== things) things.append(sprite.node);
      sort(sprite.node);
    },
    lay(node) {
      ground.append(node);
    },
    flash(effect, at, seconds) {
      const sprite = createSprite(effect);

      sprite.moveTo(at);
      effects.append(sprite.node);
      setTimeout(() => sprite.node.remove(), seconds * 1000);
    },
    follow(at, dt) {
      const ease = dt === undefined ? 1 : 1 - Math.exp(-dt * 6);

      camera = { x: camera.x + (at.x - camera.x) * ease, y: camera.y + (at.y - camera.y) * ease };
      frame();
    },
    pointAt(clientX, clientY) {
      const box = root.getBoundingClientRect();

      return { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom };
    },
  };
};
