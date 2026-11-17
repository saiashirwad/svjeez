import { random } from "svjeez";
import { OPTIONS, randomLook, type Look } from "../art/character";
import { createSprite, type Sprite } from "../play/sprite";
import { el, frameOf } from "./dom";
import { villagerSheet } from "./sheets";

export interface Villager {
  readonly name: string;
  readonly look: Look;
}

const FIELDS: readonly (readonly [key: keyof Look, label: string])[] = [
  ["skin", "Skin"],
  ["hair", "Hair"],
  ["hairColor", "Hair color"],
  ["outfit", "Outfit"],
  ["shirt", "Top"],
  ["pants", "Bottoms"],
  ["hat", "Hat"],
  ["accent", "Trim"],
];

/** The four ways the preview turns, in order: a state's facing and whether it is mirrored. */
const TURNS: readonly (readonly [facing: string, mirrored: boolean])[] = [
  ["down", false],
  ["side", false],
  ["up", false],
  ["side", true],
];

/**
 * The character maker: a live preview beside every choice in the wardrobe. Each change renders the villager again,
 * in the page, so what you see is the sprite the game will walk around.
 */
export const openWardrobe = (
  host: HTMLElement,
  from: Villager,
  first: boolean,
  done: (villager: Villager) => void,
): void => {
  let look = from.look;
  let turn = 0;
  let walking = true;
  let sprite: Sprite | undefined;
  const stand = el("div", "stand");
  const name = el("input", "name");
  const rows = el("div", "rows");
  const buttons: (readonly [HTMLButtonElement, keyof Look, string])[] = [];

  const pose = (): void => {
    const [facing, mirrored] = TURNS[turn] ?? ["down", false];

    sprite?.mirror(mirrored);
    sprite?.show(`${walking ? "walk" : "idle"}-${facing}`);
  };

  const dress = (): void => {
    sprite = createSprite(villagerSheet(look));
    pose();
    stand.replaceChildren(frameOf(sprite.node, "-34 -80 68 88"));

    for (const [button, key, value] of buttons)
      button.classList.toggle("picked", look[key] === value);
  };

  const wear = (key: keyof Look, value: string) => (): void => {
    look = { ...look, [key]: value };
    dress();
  };

  for (const [key, label] of FIELDS) {
    const choices = el("div", "choices");

    for (const value of OPTIONS[key]) {
      const swatch = value.startsWith("#");
      const button = el("button", swatch ? "swatch" : "choice", swatch ? "" : value);

      buttons.push([button, key, value]);
      button.title = swatch ? label : value;

      if (swatch) button.style.background = value;

      button.addEventListener("click", wear(key, value));

      choices.append(button);
    }

    rows.append(el("label", "", label), choices);
  }

  const spin = (by: number) => (): void => {
    turn = (turn + by + TURNS.length) % TURNS.length;
    pose();
  };

  const left = el("button", "round", "‹");
  const right = el("button", "round", "›");
  const gait = el("button", "choice", "Stand still");
  const dice = el("button", "choice", "Surprise me");
  const go = el("button", "go", first ? "Move in" : "Looks good");

  left.addEventListener("click", spin(-1));
  right.addEventListener("click", spin(1));

  gait.addEventListener("click", () => {
    walking = !walking;
    gait.textContent = walking ? "Stand still" : "Walk";
    pose();
  });

  dice.addEventListener("click", () => {
    look = randomLook(random(Math.floor(Math.random() * 2 ** 31)));
    dress();
  });

  name.value = from.name;
  name.maxLength = 14;
  name.placeholder = "Your name";
  name.spellcheck = false;

  const panel = el(
    "div",
    "wardrobe",
    el(
      "div",
      "card",
      el(
        "div",
        "mirror",
        el("h1", "", first ? "Mossbell" : "Wardrobe"),
        el(
          "p",
          "lede",
          first
            ? "A small valley, drawn as SVG. Make someone to live in it."
            : "Try something new.",
        ),
        stand,
        el("div", "turn", left, gait, right),
        dice,
      ),
      el("div", "closet", el("label", "", "Name"), name, rows, go),
    ),
  );

  go.addEventListener("click", () => {
    panel.remove();
    done({ name: name.value.trim() || "Farmer", look });
  });

  dress();
  host.append(panel);
};
