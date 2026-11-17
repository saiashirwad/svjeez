import type { Point } from "svjeez";
import type { Patch, SpriteView, World } from "./game.ts";
import type { Sheet } from "./sheet.tsx";
import { createSprite, parseScene, type Sprite } from "./sprite.ts";

/** How much of the world the camera shows, in world px. The stage scales it to cover the host. */
export interface View {
  readonly width: number;
  readonly height: number;
}

/** A world on the page: the element a frame is drawn into. */
export interface Stage {
  readonly root: SVGSVGElement;
  /** Make the sprites on the page the ones in a frame: new keys appear, missing ones go, the rest move. */
  sprites(views: readonly SpriteView[]): void;
  /** The same for patches on the ground. */
  patches(views: readonly Patch[]): void;
  /** Play a sheet once at a point, above the things, and take it away after `seconds`. */
  flash(effect: Sheet, at: Point, seconds: number): void;
  /** Move the camera toward a point. `dt` is the time since the last call; leave it out to cut. */
  follow(at: Point, dt?: number): void;
  /** Show the world's own motions at a moment, in seconds. */
  seek(seconds: number): void;
  /** The world point under a point of the page. */
  pointAt(clientX: number, clientY: number): Point;
  /** Take the world off the page. */
  remove(): void;
}

interface Movable {
  moveBefore(node: Node, before: Node | null): void;
}

/** `moveBefore` moves a node without restarting its animations. Where it is missing, the walk cycle restarts instead. */
const canMove = (parent: Element): parent is Element & Movable => "moveBefore" in parent;

const SVG = "http://www.w3.org/2000/svg";

const baseline = (node: Element | null): number =>
  node instanceof SVGElement ? Number(node.dataset["y"]) : Number.NaN;

const layer = (root: SVGSVGElement, name: string): SVGGElement => {
  const found = root.querySelector<SVGGElement>(`:scope > g[data-layer="${name}"]`);

  if (!found) throw new Error(`The world has no <g data-layer="${name}">.`);

  return found;
};

export const createStage = (host: HTMLElement, world: World, view: View): Stage => {
  const root = parseScene(world.svg);
  const ground = layer(root, "ground");
  const things = layer(root, "things");
  const effects = layer(root, "effects");
  const standing = new Map<string, { readonly sheet: Sheet; readonly sprite: Sprite }>();
  const laid = new Map<string, SVGRectElement>();
  let zoom = 1;
  let camera: Point = { x: world.width / 2, y: world.height / 2 };

  root.style.position = "absolute";
  root.style.left = "0";
  root.style.top = "0";
  root.style.transformOrigin = "0 0";
  host.append(root);

  // Read before any sprite is added, so these are the world's motions and nobody else's.
  const motions = root.getAnimations({ subtree: true });

  const frame = (): void => {
    const half = { x: host.clientWidth / zoom / 2, y: host.clientHeight / zoom / 2 };
    const x = Math.max(half.x, Math.min(world.width - half.x, camera.x));
    const y = Math.max(half.y, Math.min(world.height - half.y, camera.y));

    root.style.transform = `translate(${Math.round((half.x - x) * zoom)}px, ${Math.round((half.y - y) * zoom)}px)`;
  };

  const fit = (): void => {
    const cover = Math.max(host.clientWidth / view.width, host.clientHeight / view.height);

    zoom = world.grid ? Math.max(1, Math.round(cover * world.grid)) / world.grid : cover;
    root.setAttribute("width", String(world.width * zoom));
    root.setAttribute("height", String(world.height * zoom));
    frame();
  };

  const resized = new ResizeObserver(fit);

  resized.observe(host);
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

  const stand = (sprite: Sprite, { at, state, mirror }: SpriteView): void => {
    const moved = sprite.at.x !== at.x || sprite.at.y !== at.y || sprite.node.parentNode !== things;

    if (state !== undefined) sprite.show(state);
    sprite.mirror(mirror ?? false);

    if (!moved) return;
    sprite.moveTo(at);
    sprite.node.dataset["y"] = at.y.toFixed(1);

    if (sprite.node.parentNode !== things) things.append(sprite.node);
    sort(sprite.node);
  };

  return {
    root,
    sprites(views) {
      const seen = new Set<string>();

      for (const view of views) {
        const kept = standing.get(view.key);

        const fresh =
          kept?.sheet === view.sheet
            ? kept
            : { sheet: view.sheet, sprite: createSprite(view.sheet) };

        if (kept && kept !== fresh) kept.sprite.node.remove();
        standing.set(view.key, fresh);
        seen.add(view.key);
        stand(fresh.sprite, view);
      }

      for (const [key, { sprite }] of standing)
        if (!seen.has(key)) {
          sprite.node.remove();
          standing.delete(key);
        }
    },
    patches(views) {
      const seen = new Set<string>();

      for (const { key, area, fill, opacity } of views) {
        const rect = laid.get(key) ?? document.createElementNS(SVG, "rect");

        if (!laid.has(key)) {
          rect.setAttribute("x", String(area.x));
          rect.setAttribute("y", String(area.y));
          rect.setAttribute("width", String(area.width));
          rect.setAttribute("height", String(area.height));
          ground.append(rect);
          laid.set(key, rect);
        }

        rect.setAttribute("fill", fill);
        rect.setAttribute("opacity", String(opacity ?? 1));
        seen.add(key);
      }

      for (const [key, rect] of laid)
        if (!seen.has(key)) {
          rect.remove();
          laid.delete(key);
        }
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
    seek(seconds) {
      for (const motion of motions) {
        motion.pause();
        motion.currentTime = seconds * 1000;
      }
    },
    pointAt(clientX, clientY) {
      const box = root.getBoundingClientRect();

      return { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom };
    },
    remove() {
      resized.disconnect();
      root.remove();
    },
  };
};
